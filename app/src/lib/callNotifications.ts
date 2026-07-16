// Full-screen incoming-call notifications — the piece expo-notifications
// genuinely cannot do (confirmed by reading its native Android source
// directly: no field, no hook, nothing builds a notification with
// setFullScreenIntent anywhere in it). This is @notifee/react-native's
// job; expo-notifications' role here narrows to just what it already does
// well and what notifee doesn't do at all — receiving the push in the
// background/killed state via its own native FCM receiver, using the
// documented `registerTaskAsync`/TaskManager mechanism (Headless
// Background Notification — see
// https://docs.expo.dev/push-notifications/what-you-need-to-know/#headless-background-notifications).
// Confirmed directly in expo-notifications' native source
// (FirebaseMessagingDelegate.kt's onMessageReceived) that this background
// task fires unconditionally for EVERY incoming FCM message, data-only or
// not, regardless of app state — the same native receiver that already
// auto-displays the existing call notification today, just a second,
// independent code path off the same message. No @react-native-firebase
// dependency needed; expo-notifications already owns the FCM receiver.
import notifee, { AndroidCategory, AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { router } from 'expo-router';

export const CALL_CHANNEL_ID = 'notifee-calls';
const BACKGROUND_NOTIFICATION_TASK = 'CURRENT_BACKGROUND_NOTIFICATION_TASK';

interface CallPushData {
  kind?: string;
  callerUsername?: string | null;
  callKind?: 'voice' | 'video';
  tag?: string;
}

/**
 * Separate from (not a replacement for) the 'calls' channel
 * expo-notifications creates in push.ts — that one is what auto-displays
 * the compatibility notification (see pushPing.ts's dual-send). This one
 * is notifee's own, used only for the upgraded full-screen version, kept
 * distinct so the two libraries never fight over channel ownership/settings.
 */
export async function setupCallNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CALL_CHANNEL_ID,
    name: 'Incoming calls (full-screen)',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    visibility: AndroidVisibility.PUBLIC, // show full content over the lock screen, not a redacted placeholder
    vibration: true,
    vibrationPattern: [0, 250, 250, 250],
  });
}

async function displayFullScreenCallNotification(data: CallPushData) {
  const title = data.callKind === 'video' ? 'Incoming video call' : 'Incoming voice call';
  const body = data.callerUsername ? `@${data.callerUsername} is calling you` : 'Someone is calling you';
  await notifee.displayNotification({
    id: data.tag || 'incoming-call',
    title,
    body,
    android: {
      channelId: CALL_CHANNEL_ID,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      autoCancel: false,
      ongoing: true,
      // id: 'default' launches the app's own MainActivity (now configured
      // via plugins/withLockScreenCallActivity.js to show over the lock
      // screen) — no custom native Activity needed. Once the JS app boots
      // from this, the existing relay-replay-on-reconnect flow
      // (server/src/index.ts's auth:ok handler) is what actually drives
      // the accept/decline UI — this notification's job ends at getting
      // the app on screen over the lock screen with a ringing sound;
      // in-app call state/UI is unchanged from what already worked.
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default' },
    },
  });
}

/**
 * Parses expo-notifications' NotificationTaskPayload — the shape it
 * documents for `data` is either a NotificationResponse (an action-button
 * tap, not a raw message — skipped here) or `{ data: { dataString?: ... } }`
 * where Android's FCM delivery packs the original data payload as a JSON
 * string under `dataString`. This is my best-effort read of
 * expo-notifications' own .d.ts for this shape; I have not been able to
 * verify it against a real FCM delivery in this sandbox (see the
 * verification notes in this round's report).
 */
function parseCallPushData(taskData: unknown): CallPushData | null {
  if (!taskData || typeof taskData !== 'object') return null;
  if ('actionIdentifier' in (taskData as any)) return null; // a notification-action tap, not a raw message
  const raw = (taskData as any).data;
  if (!raw) return null;
  if (typeof raw.dataString === 'string') {
    try {
      const parsed = JSON.parse(raw.dataString);
      if (parsed?.kind === 'call') return parsed;
      return null;
    } catch {
      return null;
    }
  }
  if (raw.kind === 'call') return raw;
  return null;
}

// Per Expo's own documentation for registerTaskAsync: "define the task in
// the module scope of a JS module which is required early by your app" —
// expo-task-manager loads the JS bundle headlessly in the background and
// needs the task DEFINITION (not just its OS-level registration) to exist
// at that point, so this call is deliberately at true module scope, not
// inside the exported function below — it runs once as a side effect of
// this file being imported (from app/_layout.tsx), regardless of platform
// checks that only matter for the actual OS registration step.
if (Platform.OS === 'android') {
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error) return;
    const callData = parseCallPushData(data);
    if (!callData) return;
    // pushPing.ts's dual-send keeps title/body for old-client compatibility
    // (see server/src/pushPing.ts), which means expo-notifications' own
    // default handling auto-displays a plain notification for this same
    // push on THIS (upgraded) client too, via the SAME 'calls' channel
    // push.ts already sets up. Dismiss that one (matched by the shared
    // `tag`) and show the real full-screen version in its place, so the
    // user only ever ends up looking at one notification, not two.
    if (callData.tag) {
      await Notifications.dismissNotificationAsync(callData.tag).catch(() => {});
    }
    await displayFullScreenCallNotification(callData);
  });
}

let taskRegistered = false;

/**
 * Registers the already-defined task above with the OS — unlike
 * TaskManager.defineTask, this part doesn't need to be synchronous/at
 * module scope, so it's a normal async call from app/_layout.tsx's
 * startup effect (mirrors registerForPushNotifications' own call site).
 */
export function registerCallBackgroundTask() {
  if (Platform.OS !== 'android' || taskRegistered) return;
  taskRegistered = true;
  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[callNotifications] failed to register background task:', e?.message ?? e);
  });
}

let eventsSubscribed = false;

/**
 * Routes a tap on the full-screen call notification (or its launch itself,
 * which notifee treats as an implicit press — see EventType.PRESS) back
 * into the app. This is a fast-path only: the relay's own replay-on-
 * reconnect (server/src/index.ts's auth:ok handler) already drives
 * _layout.tsx's navigation to /incoming-call once the socket authenticates,
 * regardless of how the app was launched — this just avoids waiting on
 * that round trip if the call state is already known locally.
 */
export function subscribeToCallNotificationEvents() {
  if (Platform.OS !== 'android' || eventsSubscribed) return;
  eventsSubscribed = true;

  const onPress = () => {
    router.push('/incoming-call');
  };

  notifee.onForegroundEvent(({ type }) => {
    if (type === EventType.PRESS) onPress();
  });
  notifee.onBackgroundEvent(async ({ type }) => {
    if (type === EventType.PRESS) onPress();
  });
}
