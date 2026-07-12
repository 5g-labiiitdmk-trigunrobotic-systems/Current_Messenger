import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  // Message pings stay silent-banner-only (existing behavior) — but a call
  // notification should actually ring, same as a phone call or WhatsApp
  // call notification, since it's telling you someone wants you *right now*,
  // not "catch up whenever." See pingIncomingCall in server/src/pushPing.ts
  // for the `data: { kind: 'call' }` this checks for.
  handleNotification: async (notification) => {
    const isCall = notification.request.content.data?.kind === 'call';
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: isCall,
      shouldSetBadge: false,
    };
  },
});

const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

// registerForPushNotifications() is called on every auth state change
// (sign-in, and roughly hourly on Supabase's own token refresh — see
// authStore.ts) — without this guard, the token-refresh listener below
// would accumulate a new duplicate subscription every single time.
let tokenListenerRegistered = false;

async function fetchAndStoreToken(userId: string): Promise<void> {
  // Explicit projectId rather than relying on auto-detection from
  // Constants — recommended by Expo's own docs, and removes one point of
  // failure this app can't otherwise see: if this throws, the token never
  // gets stored and every future "recipient offline" ping to this user
  // silently no-ops (pushPing.ts finds no push_token and returns early,
  // with nothing surfaced anywhere that a human would ever see).
  //
  // Logged unconditionally (not just on failure) — "did this device ever
  // actually get a token and save it" is the single most useful fact when
  // push isn't arriving at all, and there was previously no way to confirm
  // it happened short of reading raw Postgres rows.
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[push] getExpoPushTokenAsync threw — no token obtained:', e?.message ?? e);
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[push] obtained Expo push token:', token);
  const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[push] failed to store push token:', error.message);
  } else {
    // eslint-disable-next-line no-console
    console.log('[push] push token stored for user', userId);
  }
}

/**
 * Registers this device for ping-only push notifications and stores the
 * Expo push token on the user's profile. The relay uses this token only to
 * fire a contentless "someone tried to reach you" ping when a message hard-
 * fails because the recipient is offline — see server/src/pushPing.ts.
 * No message content ever travels through push.
 */
export async function registerForPushNotifications(userId: string) {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.DEFAULT });
      // Separate, higher-importance channel for calls — Android needs
      // HIGH+ importance (with sound) at the channel level to show a
      // heads-up banner and actually ring; the per-notification
      // `priority`/`sound` fields alone aren't enough once a channel with
      // lower importance already exists, and channel settings can't be
      // changed later except by the user in system settings.
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      // eslint-disable-next-line no-console
      console.warn('[push] permission not granted — registration skipped, status:', status);
      return;
    }

    await fetchAndStoreToken(userId);

    // Push tokens can rotate over a device's lifetime (FCM/APNs token
    // refresh, not just app reinstall) — without re-registering when that
    // happens, push silently stops working until something else happens to
    // call registerForPushNotifications again (e.g. the next Supabase auth
    // token refresh, roughly hourly). This makes it immediate instead of
    // "eventually, maybe."
    if (!tokenListenerRegistered) {
      tokenListenerRegistered = true;
      Notifications.addPushTokenListener(() => {
        fetchAndStoreToken(userId).catch((e) => {
          // eslint-disable-next-line no-console
          console.error('[push] failed to re-register rotated token:', e?.message ?? e);
        });
      });
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[push] registerForPushNotifications failed:', e?.message ?? e);
  }
}
