import { supabaseAdmin } from './supabaseAdmin.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Small cache so a burst of retries to an offline user doesn't spam pushes.
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

  const { data, error } = await supabaseAdmin.from('users').select('push_token').eq('id', recipientId).maybeSingle();
  if (error || !data?.push_token) return;

  lastPingAt.set(recipientId, Date.now());

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        to: data.push_token,
        title: 'Current',
        body: senderUsername ? `@${senderUsername} tried to reach you` : 'Someone tried to reach you',
        sound: null,
        priority: 'high',
      }),
    });
    // Expo's push API returns 200 even for a per-notification failure (e.g.
    // an invalid/unregistered token) — the actual outcome is inside the
    // response body's ticket, not the HTTP status. Logging this is the only
    // way "push isn't arriving" is ever diagnosable from server logs at
    // all; this was previously a fully silent catch-and-drop with zero
    // visibility into whether pushes were even being attempted correctly.
    const body: any = await res.json().catch(() => null);
    const ticket = body?.data;
    if (!res.ok || ticket?.status === 'error') {
      // eslint-disable-next-line no-console
      console.error('[push] Expo push send failed:', res.status, JSON.stringify(ticket ?? body));
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[push] Expo push request threw:', e?.message ?? e);
    // best-effort only — a failed ping must never block or retry the message send
  }
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

  const { data, error } = await supabaseAdmin.from('users').select('push_token').eq('id', recipientId).maybeSingle();
  if (error || !data?.push_token) return;

  lastCallPingAt.set(recipientId, Date.now());

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        to: data.push_token,
        title: callKind === 'video' ? 'Incoming video call' : 'Incoming voice call',
        body: callerUsername ? `@${callerUsername} is calling you` : 'Someone is calling you',
        sound: 'default',
        priority: 'high',
        channelId: 'calls',
        // Lets the client's notification handler tell a call apart from an
        // ordinary message ping so it can route straight to the
        // incoming-call screen instead of just opening to the last screen.
        data: { kind: 'call', callerUsername: callerUsername ?? null },
      }),
    });
    const body: any = await res.json().catch(() => null);
    const ticket = body?.data;
    if (!res.ok || ticket?.status === 'error') {
      // eslint-disable-next-line no-console
      console.error('[push] Expo call push send failed:', res.status, JSON.stringify(ticket ?? body));
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[push] Expo call push request threw:', e?.message ?? e);
  }
}
