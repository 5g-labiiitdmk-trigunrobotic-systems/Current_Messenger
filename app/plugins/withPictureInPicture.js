const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// PiP-relevant configChanges values Android needs so the Activity isn't
// destroyed/recreated during a PiP mode transition. Merged into whatever's
// already there (confirmed via a local prebuild that the base template
// already declares all of these — keyboard|keyboardHidden|orientation|
// screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths — so this
// is a no-op today, not an assumption) rather than overwriting the
// attribute outright, since a future RN/Expo template change could add or
// remove entries this plugin has no reason to know about.
const PIP_CONFIG_CHANGES = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'];

/**
 * See modules/pip-controller for the native module this pairs with.
 * supportsPictureInPicture is the one purely-declarative manifest flag PiP
 * needs — actually entering PiP mode still requires a runtime call
 * (Activity.enterPictureInPictureMode), which is what that module's
 * OnUserLeavesActivity hook does; this plugin only makes the Activity
 * eligible to be asked.
 */
function withPictureInPicture(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    mainActivity.$['android:supportsPictureInPicture'] = 'true';

    const existing = (mainActivity.$['android:configChanges'] ?? '').split('|').filter(Boolean);
    const merged = new Set(existing);
    for (const value of PIP_CONFIG_CHANGES) merged.add(value);
    mainActivity.$['android:configChanges'] = [...merged].join('|');

    return config;
  });
}

module.exports = withPictureInPicture;
