const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Play Console's "orientation/large-screen" quality warning: MainActivity's
 * android:screenOrientation="portrait" lock (set by the base RN/Expo
 * template, not this app specifically) will be ignored on large
 * screens/foldables starting with Android 16's large-screen compatibility
 * policy — the OS can resize/reorient the activity regardless of the
 * lock. This is damage-control scope, not a real tablet/landscape
 * redesign (see docs comment near the top of app/[id].tsx-equivalent
 * screens, or the round's own report, for why a full redesign wasn't
 * done): the portrait lock itself is left in place (removing it is the
 * bigger, explicitly out-of-scope change), and this only adds the one
 * declarative flag that tells the system this Activity can actually
 * handle being resized/reoriented instead of assuming it can't —
 * android:resizeableActivity, which was previously unset (defaulting to
 * true already on API 24+, but Play Console's own guidance wants it
 * explicit rather than relying on the default). Everything else this
 * warning is about is a question of whether the app's own screens
 * visibly break at a wider/landscape viewport, which is a React
 * Native/flexbox layout property, not something a manifest flag
 * controls — see this round's report for how that was actually checked.
 */
function withLargeScreenSupport(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    mainActivity.$['android:resizeableActivity'] = 'true';
    return config;
  });
}

module.exports = withLargeScreenSupport;
