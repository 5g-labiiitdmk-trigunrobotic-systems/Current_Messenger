package expo.modules.pipcontroller

import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Minimal native surface for Android Picture-in-Picture during an active
 * video call (see src/lib/pipController.ts and src/state/callStore.ts for
 * the JS side). Deliberately small: JS only ever tells this module whether
 * PiP is currently appropriate (setPipEligible, called whenever the call's
 * phase/kind changes) — the actual enter-PiP trigger runs natively here,
 * inside OnUserLeavesActivity, which fires from Android's own
 * Activity.onUserLeaveHint (e.g. the user pressing Home or switching apps).
 * That's the OS-recommended moment to decide whether to enter PiP, and is
 * more reliable than JS trying to infer the right moment from AppState
 * timing on its own.
 *
 * No onPictureInPictureModeChanged bridge exists here. The Expo Modules
 * lifecycle-hook DSL this SDK version ships (see ModuleDefinitionBuilder.kt
 * in expo-modules-core) exposes OnUserLeavesActivity /
 * OnActivityEntersForeground / OnActivityEntersBackground, but not a
 * PiP-mode-change callback specifically — adding one would require directly
 * editing the generated MainActivity.kt's source via a config plugin, which
 * was deliberately avoided so this module's entire native footprint is
 * built only on already-wired-up, officially documented Expo Modules DSL
 * hooks rather than hand-inserted source patches. The JS side therefore
 * infers "probably in PiP now" from backgrounding while eligible, not a
 * guaranteed-accurate native signal — see pipController.ts's own comment.
 */
class PipControllerModule : Module() {
  private var pipEligible = false

  override fun definition() = ModuleDefinition {
    Name("PipController")

    Function("isPipSupported") {
      isPipSupportedOnThisDevice()
    }

    Function("setPipEligible") { eligible: Boolean ->
      pipEligible = eligible
    }

    OnUserLeavesActivity {
      if (!pipEligible || !isPipSupportedOnThisDevice()) {
        return@OnUserLeavesActivity
      }
      val activity = appContext.currentActivity ?: return@OnUserLeavesActivity
      try {
        activity.enterPictureInPictureMode(PictureInPictureParams.Builder().build())
      } catch (e: Exception) {
        // enterPictureInPictureMode can throw on some OEM builds/device
        // states (e.g. multi-window restrictions, or the activity not
        // being resumed) — better to silently stay full-screen than crash
        // the app over a PiP request.
        Log.e("PipController", "enterPictureInPictureMode failed", e)
      }
    }
  }

  private fun isPipSupportedOnThisDevice(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    val pm = appContext.reactContext?.packageManager ?: return false
    return pm.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
  }
}
