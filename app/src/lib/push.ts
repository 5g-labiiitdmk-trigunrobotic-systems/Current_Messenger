import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { useCallStore } from '../state/callStore';

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

function handleCallNotificationTap(data: Record<string, unknown> | undefined) {
  if (data?.kind !== 'call') return;
  // Only a fast-path: if the app was already warm and already knows about
  // this call (e.g. the user backgrounded away from /incoming-call without
  // answering, then came back via the notification), jump straight there.
  // For the fully-closed cold-start case, `incoming` won't be populated
  // yet at this exact moment — the socket has to connect and authenticate
  // first, which is what triggers the relay to replay the pending ring
  // (see the auth:ok handler in server/src/index.ts). Once that replay
  // arrives, _layout.tsx's own navigation subscriber handles it exactly
  // like any other incoming call — no separate code path needed here for
  // that case.
  if (useCallStore.getState().incoming) {
    router.push('/incoming-call');
  }
}

let notificationRoutingInitialized = false;

/**
 * Wires up notification-tap handling: a tapped call notification should
 * bring the user to the ringing screen, not just open the app to wherever
 * it last was. Call once, globally — unlike registerForPushNotifications
 * (per-sign-in), this doesn't depend on auth state.
 */
export function initNotificationRouting() {
  if (notificationRoutingInitialized) return;
  notificationRoutingInitialized = true;
  // getLastNotificationResponse/addNotificationResponseReceivedListener
  // throw "not available on web" — this is native-only functionality (a
  // real notification tray tap), and this project's own web-based
  // verification workflow (expo export/start --platform web) needs the
  // app to still boot without it. Unlike the Android-only channel setup
  // in registerForPushNotifications, this isn't behind a Platform.OS
  // check anywhere upstream, so it needs its own guard here.
  if (Platform.OS === 'web') return;

  // Cold start via notification tap (app was fully closed): the response
  // that launched the app isn't delivered through the live listener below,
  // it has to be fetched explicitly.
  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) {
    handleCallNotificationTap(lastResponse.notification.request.content.data as Record<string, unknown> | undefined);
    Notifications.clearLastNotificationResponse();
  }

  // Warm tap: app already running (foreground or backgrounded, JS alive).
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleCallNotificationTap(response.notification.request.content.data as Record<string, unknown> | undefined);
  });
}
