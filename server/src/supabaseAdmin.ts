import { createClient } from '@supabase/supabase-js';

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

export async function verifyUserToken(token: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// Short-lived cache so rapid-fire events (typing, read receipts) don't hammer
// Postgres with a lookup per keystroke. Message sends still get a fresh-enough
// answer within 30s of an approval/decline, which is fine for this use case.
const contactCache = new Map<string, { approved: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export async function areApprovedContacts(userA: string, userB: string): Promise<boolean> {
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
  contactCache.set(key, { approved, expiresAt: Date.now() + CACHE_TTL_MS });
  return approved;
}

const usernameCache = new Map<string, string>();

export async function getUsername(userId: string): Promise<string | null> {
  if (usernameCache.has(userId)) return usernameCache.get(userId)!;
  const { data, error } = await supabaseAdmin.from('users').select('username').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  usernameCache.set(userId, data.username);
  return data.username;
}

/**
 * Metadata-only delivery log: one row per successfully delivered message.
 * NEVER logs message content — the payload is opaque ciphertext that never
 * reaches Postgres; only who→who, when, and how many bytes. Fire-and-forget:
 * a logging failure must never block or fail an actual delivery.
 */
export function logTransfer(senderId: string, recipientId: string, byteSize: number): void {
  supabaseAdmin
    .from('message_transfer_log')
    .insert({ sender_id: senderId, recipient_id: recipientId, byte_size: byteSize })
    .then(({ error }) => {
      // eslint-disable-next-line no-console
      if (error) console.error('[relay] transfer log write failed:', error.message);
    });
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('blocked_users')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
