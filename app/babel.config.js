// FILE PURPOSE: Babel config for this Expo project. Uses Expo's own
// preset (which handles JSX, TypeScript, and Metro/Hermes-appropriate
// transforms) plus the one plugin react-native-reanimated requires to
// work at all (its worklet transform). api.cache(true) tells Babel this
// config never varies by environment, so it's safe to cache across
// builds.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
