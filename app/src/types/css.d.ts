// maplibre-gl's own .d.ts doesn't declare its side-effect CSS import target
// (maplibre-gl/dist/maplibre-gl.css), so plain `tsc` module resolution has
// no type for it without this. Metro's web bundler (Expo's default,
// documented to support CSS imports for web builds) doesn't need this —
// it's purely to satisfy `tsc --noEmit`.
declare module '*.css';
