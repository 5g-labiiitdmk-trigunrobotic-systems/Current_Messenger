const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Full-screen-intent call notifications (see src/lib/callNotifications.ts)
 * launch this app's MainActivity directly, but Android's default Activity
 * behavior is to sit BEHIND the lock screen until the user unlocks first —
 * a real call needs to show its accept/decline UI OVER the lock screen
 * without requiring that, same as the native phone dialer. There is no
 * app.json-level field for this (it's not something any Expo/notifee/
 * react-native-webrtc plugin already sets), and expo-notifications/notifee
 * are both purely notification-display libraries — neither one controls
 * the launched Activity's own window flags. This is a real, separate
 * requirement: `android:showWhenLocked` + `android:turnScreenOn` on the
 * MainActivity manifest entry (the Android 8.1+ declarative equivalent of
 * calling Window.setShowWhenLocked(true)/setTurnScreenOn(true) at runtime).
 *
 * Scoped to MainActivity specifically (not every activity in the app) —
 * only the one that a call notification's full-screen action ever
 * launches into needs this; nothing else in the app should bypass the
 * lock screen.
 */
function withLockScreenCallActivity(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    mainActivity.$['android:showWhenLocked'] = 'true';
    mainActivity.$['android:turnScreenOn'] = 'true';
    return config;
  });
}

module.exports = withLockScreenCallActivity;
