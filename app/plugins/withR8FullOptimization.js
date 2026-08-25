// FILE PURPOSE: A local Expo config plugin (referenced from app.json's
// "plugins" array) that closes two real, currently-missing R8 release-
// build optimizations — see the two function-level doc comments below for
// why each exists and, for the second one specifically, why it carries
// more real-device verification risk than most changes in this project.
const { withGradleProperties, withAppBuildGradle, AndroidConfig } = require('@expo/config-plugins');

/**
 * Low-risk half: adds android.r8.optimizedResourceShrinking=true to
 * gradle.properties. This project's AGP version (8.12.0, confirmed by
 * reading node_modules/@react-native/gradle-plugin/gradle/libs.versions.toml
 * — not assumed) only auto-enables R8's optimized resource shrinking
 * starting at AGP 9.0; on 8.12/8.13 it's opt-in via this exact flag
 * (confirmed against Android's own "Enable app optimization with R8"
 * documentation). This only changes how already-enabled resource
 * shrinking (enableShrinkResourcesInReleaseBuilds, set via
 * expo-build-properties) removes/dedupes unused resource entries more
 * thoroughly — it doesn't touch bytecode/reflection behavior at all, so
 * it carries none of the risk the optimize-mode change below does.
 *
 * Reused via AndroidConfig.BuildProperties.createBuildGradlePropsConfigPlugin
 * — the exact same helper expo-build-properties itself uses internally
 * for enableMinifyInReleaseBuilds/enableShrinkResourcesInReleaseBuilds
 * (confirmed by reading expo-build-properties' own android.js), so this
 * writes to gradle.properties the identical, already-proven way rather
 * than hand-rolling a new gradle.properties mod.
 */
const withOptimizedResourceShrinking = AndroidConfig.BuildProperties.createBuildGradlePropsConfigPlugin(
  [{ propName: 'android.r8.optimizedResourceShrinking', propValueGetter: () => 'true' }],
  'withOptimizedResourceShrinking'
);

/**
 * Higher-risk half: swaps android/app/build.gradle's release
 * proguardFiles from getDefaultProguardFile("proguard-android.txt") to
 * getDefaultProguardFile("proguard-android-optimize.txt") — RN/Expo's
 * generated template has always used the former, which starts with a
 * bare `-dontoptimize` directive (confirmed against the actual file
 * content of both, and against Android's own tooling history): it
 * disables R8's bytecode optimization PASS entirely, leaving only
 * shrinking + obfuscation running. This is a genuinely different knob
 * from "R8 full mode" (android.enableR8.fullMode, already on by default
 * at this AGP version, confirmed via grep — nothing here disables it) —
 * full mode only changes how optimizations behave once they run;
 * -dontoptimize prevents them from running at all. This is very likely
 * the concrete cause behind Play Console's "higher memory usage / lower
 * performance" framing for its R8 warning, since skipping the entire
 * optimization pass is the single most direct match for that symptom.
 *
 * REAL RISK, DISCLOSED: -dontoptimize was originally a Dalvik-era safety
 * default (ProGuard's optimize step could break old Dalvik bytecode) that
 * React Native's template has carried forward unchanged ever since,
 * unrelated to that original reason once R8 replaced ProGuard's optimizer
 * years ago — but real-world reports (e.g. Detox's own proguard docs)
 * still show aggressive optimization occasionally breaking reflection-
 * heavy code paths in ways only a real release build surfaces, never
 * tsc/prebuild/a web export. This project has its own history of R8
 * changes that only broke at runtime, not compile time (see this same
 * plugins/ directory's git history and app.json's expo-build-properties
 * extraProguardRules comment for the maps/incallmanager keep rules that
 * history produced) — the existing proguard-rules.pro's keep rules were
 * researched for shrinking/obfuscation-era breakage, not specifically
 * for full bytecode optimization, so this specific change has NOT been
 * verified on a real release build or device (this sandbox has no
 * Android SDK to run one) and should get an actual `assembleRelease`/
 * `bundleRelease` + real-device smoke test before this ships wide.
 */
function withProguardOptimizeFile(config) {
  return withAppBuildGradle(config, (config) => {
    const original = 'getDefaultProguardFile("proguard-android.txt")';
    const replacement = 'getDefaultProguardFile("proguard-android-optimize.txt")';
    if (config.modResults.contents.includes(original)) {
      config.modResults.contents = config.modResults.contents.replace(original, replacement);
    }
    // If `original` isn't found, the template has already changed (or
    // this mod already ran) — nothing to do, and nothing to break by
    // silently no-op'ing rather than throwing.
    return config;
  });
}

function withR8FullOptimization(config) {
  config = withOptimizedResourceShrinking(config);
  config = withProguardOptimizeFile(config);
  return config;
}

// Exported as the plugin function itself.
module.exports = withR8FullOptimization;
