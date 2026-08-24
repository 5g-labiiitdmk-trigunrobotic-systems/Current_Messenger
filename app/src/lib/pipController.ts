import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// FILE PURPOSE: JS bridge to the native PipController module (see
// modules/pip-controller/) that drives Android picture-in-picture for
// video calls. See pipController.web.ts for the no-op web stand-in.
//
// Android only for now (see modules/pip-controller/expo-module.config.json
// — platforms: ["android"]; iOS support is deliberately out of scope this
// round, matching this project's current Android-first phase). On iOS the
// native module was never linked, so requireOptionalNativeModule returns
// null and every export below safely no-ops rather than throwing.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<{ isPipSupported(): boolean; setPipEligible(eligible: boolean): void }>('PipController') : null;

/** Whether this device/OS version can actually enter PiP (Android 8+, device declares the PiP system feature). */
export function isPipSupported(): boolean {
  return native?.isPipSupported() ?? false;
}

/**
 * Tell the native side whether entering PiP is currently appropriate — the
 * actual enter-PiP trigger runs natively (see PipControllerModule.kt's
 * OnUserLeavesActivity), firing only when the user actually backgrounds the
 * app (Home button / app switch) while this is true. Call with true only
 * while there's an active VIDEO call on screen; false otherwise (call
 * ended, call is voice-only, or the call screen unmounted) — see
 * call/[id].tsx's usage.
 */
export function setPipEligible(eligible: boolean): void {
  native?.setPipEligible(eligible);
}
