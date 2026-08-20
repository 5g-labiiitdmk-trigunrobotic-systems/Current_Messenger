const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Real-device testing this session went through two broken combinations
 * before landing here, both confirmed by tracing the actual mechanics
 * involved rather than guessing again:
 *
 * 1. windowSoftInputMode="adjustResize" (Expo's undocumented default when
 *    android.softwareKeyboardLayoutMode is unset) + KeyboardAvoidingView
 *    behavior='height' on the chat composer: an immediate, non-animating
 *    gap appeared the instant the keyboard opened — adjustResize already
 *    shrinks the window natively, and KeyboardAvoidingView's own 'height'
 *    calculation then shrinks it AGAIN on top of that.
 * 2. Trying android.softwareKeyboardLayoutMode: "pan" (adjustPan) instead,
 *    still with behavior='height': WORSE — the composer ended up rendered
 *    near the top of the screen with a large empty gap down to the
 *    keyboard. Traced directly in KeyboardAvoidingView's own source
 *    (node_modules/react-native/Libraries/Components/Keyboard/
 *    KeyboardAvoidingView.js): its 'height' behavior computes
 *    `frame.y + frame.height - keyboardY`, where `frame` is captured via
 *    RN's own onLayout — a purely JS-side layout measurement that adjustPan
 *    never updates, because adjustPan's compensation is a native-level
 *    visual pan of the whole window, invisible to RN's layout tree. So
 *    KeyboardAvoidingView computed a full keyboard-height shift as if NO
 *    native compensation had happened, and applied it on top of the pan
 *    the OS had already done — roughly double the necessary shift in the
 *    same direction, this time additive rather than the smaller gap from
 *    case 1.
 *
 * Both adjustResize and adjustPan are active OS-level keyboard
 * compensation — neither is a neutral no-op, so both fight with
 * KeyboardAvoidingView's own JS-driven compensation no matter which one
 * is picked. Expo's app.json android.softwareKeyboardLayoutMode option
 * only exposes "resize" | "pan" (see node_modules/@expo/config-plugins/
 * build/android/WindowSoftInputMode.js) — neither is what's actually
 * needed here, which is Android's third, older windowSoftInputMode value:
 * "adjustNothing". Under adjustNothing the OS does not resize or pan the
 * window at all when the keyboard opens — the keyboard purely overlays
 * on top, and the keyboardDidShow/keyboardDidHide events RN's Keyboard
 * module listens to still fire normally (adjustNothing doesn't suppress
 * those, only the OS's own automatic repositioning), so
 * KeyboardAvoidingView's 'height' behavior remains the ONLY thing moving
 * content — exactly how it already works, unopposed, on iOS. This isn't
 * expressible via Expo's built-in config option, hence this plugin
 * setting it directly on the manifest.
 */
function withAdjustNothingSoftInput(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    mainActivity.$['android:windowSoftInputMode'] = 'adjustNothing';
    return config;
  });
}

module.exports = withAdjustNothingSoftInput;
