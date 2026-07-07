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
    await fetch(EXPO_PUSH_URL, {
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
  } catch {
    // best-effort only — a failed ping must never block or retry the message send
  }
}
