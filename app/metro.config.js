const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads a WASM SQLite build via a Web
// Worker (node_modules/expo-sqlite/web/worker.ts imports a .wasm file
// directly) — Metro doesn't treat .wasm as a bundleable asset by default,
// which breaks the *entire* web bundle (not just SQLite screens) the
// moment anything imports expo-sqlite, since app/_layout.tsx pulls in
// chatStore.ts -> localDb.ts -> expo-sqlite globally. Native builds are
// unaffected (they never go through this resolver path at all); this is
// purely to keep `expo export --platform web` / `expo start --web`
// working, which this project's own verification workflow depends on.
config.resolver.assetExts.push('wasm');

module.exports = config;
