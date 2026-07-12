import { supabaseAdmin } from './supabaseAdmin.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushOptions {
  title: string;
  body: string;
  sound?: 'default' | null;
  channelId?: string;
  data?: Record<string, unknown>;
}

/**
 * Shared send path for every push notification this relay fires. Looks up
 * the recipient's stored Expo push token and posts to Expo's push API.
 * Logs (rather than silently swallowing) every distinct way this can fail:
 * the push_token lookup itself erroring (bad SUPABASE_URL/
 * SUPABASE_SERVICE_ROLE_KEY on this environment, a network blip to
 * Supabase, an RLS surprise), and Expo's own per-notification ticket
 * failure (most commonly: this Expo/EAS project has no FCM V1 service
 * account credentials configured, which silently breaks *all* Android push
 * since Google shut down the legacy FCM HTTP API — see docs/SETUP.md).
 * A user simply never having registered a push token is the one case that
 * stays quiet, since that's an expected, unremarkable state.
 */
async function sendExpoPush(recipientId: string, opts: ExpoPushOptions): Promise<void> {
  const { data, error } = await supabaseAdmin.from('users').select('push_token').eq('id', recipientId).maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[push] push_token lookup failed for', recipientId, ':', error.message);
    return;
  }
  if (!data?.push_token) return;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        to: data.push_token,
        title: opts.title,
        body: opts.body,
        sound: opts.sound ?? null,
        priority: 'high',
        channelId: opts.channelId ?? 'default',
        ...(opts.data ? { data: opts.data } : {}),
      }),
    });
    // Expo's push API returns 200 even for a per-notification failure (e.g.
    // an invalid/unregistered token, or missing FCM credentials on this
    // Expo project) — the actual outcome is inside the response body's
    // ticket, not the HTTP status.
    const body: any = await res.json().catch(() => null);
    const ticket = body?.data;
    if (!res.ok || ticket?.status === 'error') {
      // eslint-disable-next-line no-console
      console.error('[push] Expo push send failed:', res.status, JSON.stringify(ticket ?? body));
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[push] Expo push request threw:', e?.message ?? e);
    // best-effort only — a failed push must never block or retry the thing that triggered it
  }
}

// Small cooldown so a burst of retries to an offline user doesn't spam pushes.
const lastPingAt = new Map<string, number>();
const PING_COOLDOWN_MS = 60_000;

/**
 * Fires a content-free "someone tried to reach you" push when a message
 * hard-fails because the recipient is offline. This is the only reason push
 * notifications exist here: since nothing is ever queued, a ping is the sole
 * way the recipient finds out to come back online — the notification itself
 * carries the sender's username at most, never message content.
 */
export async function pingOfflineRecipient(recipientId: string, senderUsername: string | null) {
  const last = lastPingAt.get(recipientId) ?? 0;
  if (Date.now() - last < PING_COOLDOWN_MS) return;
  lastPingAt.set(recipientId, Date.now());
  await sendExpoPush(recipientId, {
    title: 'Current',
    body: senderUsername ? `@${senderUsername} tried to reach you` : 'Someone tried to reach you',
  });
}

const lastCallPingAt = new Map<string, number>();
const CALL_PING_COOLDOWN_MS = 5_000;

/**
 * Fires a push notification for an incoming call, unlike pingOfflineRecipient
 * this is NOT gated on the recipient being offline — the relay only knows
 * "has an open WebSocket," which is also true for an app sitting backgrounded
 * with the screen off, and that's exactly the case a call notification most
 * needs to cover (a message ping is fine to skip when the recipient looks
 * online; a call ringing with no visible/audible alert on a backgrounded app
 * is the whole bug this exists to fix). Still best-effort and still subject
 * to this app's no-queueing rule: if the recipient never opens the app while
 * the caller is still ringing, the call itself is simply missed, same as any
 * other offline call today — this only widens the window by getting them a
 * native OS notification instead of nothing.
 */
export async function pingIncomingCall(recipientId: string, callerUsername: string | null, callKind: 'voice' | 'video') {
  const last = lastCallPingAt.get(recipientId) ?? 0;
  if (Date.now() - last < CALL_PING_COOLDOWN_MS) return;
  lastCallPingAt.set(recipientId, Date.now());
  await sendExpoPush(recipientId, {
    title: callKind === 'video' ? 'Incoming video call' : 'Incoming voice call',
    body: callerUsername ? `@${callerUsername} is calling you` : 'Someone is calling you',
    sound: 'default',
    channelId: 'calls',
    // Lets the client's notification handler tell a call apart from an
    // ordinary message ping so it can route straight to the incoming-call
    // screen instead of just opening to the last screen.
    data: { kind: 'call', callerUsername: callerUsername ?? null },
  });
}

const lastContactPingAt = new Map<string, number>();
const CONTACT_PING_COOLDOWN_MS = 60_000;

/**
 * Fires a push for a new contact request. contact_requests rows are written
 * directly from the client to Supabase (see app/src/state/contactStore.ts)
 * — the relay never sees that insert, so it can't trigger this on its own;
 * the client calls it explicitly via the contact:request_sent event right
 * after a successful insert (see the case handler in index.ts). Best-effort
 * only: Supabase's contact_requests table remains the source of truth
 * regardless of whether this push succeeds.
 */
export async function pingContactRequest(recipientId: string, senderUsername: string | null) {
  const last = lastContactPingAt.get(recipientId) ?? 0;
  if (Date.now() - last < CONTACT_PING_COOLDOWN_MS) return;
  lastContactPingAt.set(recipientId, Date.now());
  await sendExpoPush(recipientId, {
    title: 'New contact request',
    body: senderUsername ? `@${senderUsername} wants to add you` : 'Someone wants to add you as a contact',
  });
}
