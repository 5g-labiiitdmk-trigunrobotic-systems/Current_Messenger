import { createClient } from '@supabase/supabase-js';

// FILE PURPOSE: The relay's server-side Supabase client (service-role,
// bypasses RLS) plus every Postgres-backed check the relay needs — auth
// token verification, contact-approval, block checks, username lookup,
// and the metadata-only delivery log.
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[relay] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. ' +
      'Auth verification and contact-approval checks will fail until you set them — see docs/SETUP.md. ' +
      'IMPORTANT: the service role key is a secret. It must only ever live in the relay server env, never in the app.'
  );
}

// Service-role client: bypasses RLS so the relay can check contact-approval /
// block state server-side. This client only ever reads metadata tables — it
// never touches message content, because message content never reaches Postgres.
export const supabaseAdmin = createClient(url || 'https://placeholder.supabase.co', serviceRoleKey || 'placeholder', {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Validates a client-supplied Supabase access token and returns the
// authenticated userId, or null if it's invalid/expired.
export async function verifyUserToken(token: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// Short-lived cache so rapid-fire events (typing, read receipts) don't hammer
// Postgres with a lookup per keystroke. Message sends still get a fresh-enough
// answer within 30s of an approval/decline, which is fine for this use case.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const contactCache = new Map<string, { approved: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

// The server-side gate behind every message:send / call:signal / etc. —
// true only if the two users have an approved contact_requests row in
// either direction. Cached per unordered pair (see contactCache above).
export async function areApprovedContacts(userA: string, userB: string): Promise<boolean> {
  // Both ids end up inside a PostgREST filter string below. `userB` is often
  // client-supplied (the `to` of an event), and a crafted value such as
  // "x),and(sender_id.neq.0,receiver_id.neq.0" would rewrite the filter so any
  // approved row matches — i.e. bypass the contact check. Real ids are always
  // UUIDs, so anything else is simply "not a contact" (and is never cached).
  if (!UUID_RE.test(userA) || !UUID_RE.test(userB)) return false;
  const key = [userA, userB].sort().join(':');
  const cached = contactCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.approved;

  const { data, error } = await supabaseAdmin
    .from('contact_requests')
    .select('id')
    .eq('status', 'approved')
    .or(
      `and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`
    )
    .limit(1)
    .maybeSingle();
  const approved = !error && !!data;
  // Only a confirmed "yes" is cached. A "no" (or a database error) used to be
  // cached too, so someone whose request had JUST been accepted — or who hit a
  // momentary database hiccup — kept getting "not a contact" for up to 30 s.
  if (approved) {
    if (contactCache.size > 5000) {
      const now = Date.now();
      for (const [k, v] of contactCache) if (v.expiresAt <= now) contactCache.delete(k);
    }
    contactCache.set(key, { approved, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return approved;
}

// Forget the cached answer for a pair — called when the relay is told their
// contact request changed (accepted / declined / re-sent), so a stale "yes"
// doesn't outlive a decline.
export function invalidateContactCache(userA: string, userB: string): void {
  contactCache.delete([userA, userB].sort().join(':'));
}

// True if a contact_requests row exists from `senderId` to `receiverId` with
// one of the given statuses. Used to check a client's "I just sent / answered a
// request" notification against the real database row before the relay acts on
// it (push notification, live refresh nudge). Fails closed: any error, or a
// non-UUID id, means "no such request".
export async function hasContactRequest(senderId: string, receiverId: string, statuses: ('pending' | 'approved' | 'declined')[]): Promise<boolean> {
  if (!UUID_RE.test(senderId) || !UUID_RE.test(receiverId)) return false;
  const { data, error } = await supabaseAdmin
    .from('contact_requests')
    .select('id')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .in('status', statuses)
    .limit(1)
    .maybeSingle();
  return !error && !!data;
}

// Unlike contactCache above, this cache has no TTL — a username change
// won't be reflected here until the relay process restarts.
const usernameCache = new Map<string, string>();

// Looks up (and caches) a user's username, e.g. for a call notification's
// display text.
export async function getUsername(userId: string): Promise<string | null> {
  if (usernameCache.has(userId)) return usernameCache.get(userId)!;
  const { data, error } = await supabaseAdmin.from('users').select('username').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  usernameCache.set(userId, data.username);
  return data.username;
}

// Set ENABLE_TRANSFER_LOG=false on Render (or unset it) to stop writing to
// message_transfer_log entirely — no code change or redeploy needed, just
// flip the env var and restart the service. Defaults to on.
const TRANSFER_LOG_ENABLED = process.env.ENABLE_TRANSFER_LOG !== 'false';

/**
 * Metadata-only delivery log: one row per successfully delivered message.
 * NEVER logs message content — the payload is opaque ciphertext that never
 * reaches Postgres; only who→who, when, and how many bytes. Fire-and-forget:
 * a logging failure must never block or fail an actual delivery.
 */
export function logTransfer(senderId: string, recipientId: string, byteSize: number): void {
  if (!TRANSFER_LOG_ENABLED) return;
  supabaseAdmin
    .from('message_transfer_log')
    .insert({ sender_id: senderId, recipient_id: recipientId, byte_size: byteSize })
    .then(({ error }) => {
      // eslint-disable-next-line no-console
      if (error) console.error('[relay] transfer log write failed:', error.message);
    });
}

// True if blockerId has blocked blockedId specifically (directional,
// unlike areApprovedContacts) — checked before allowing message delivery.
export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('blocked_users')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .limit(1)
    .maybeSingle();
  // Fail closed: if the block list can't be read, treat the sender as blocked
  // rather than let a blocked person's message through (areApprovedContacts
  // already refuses on a database error, so nothing legitimate works then
  // either).
  if (error) return true;
  return !!data;
}
