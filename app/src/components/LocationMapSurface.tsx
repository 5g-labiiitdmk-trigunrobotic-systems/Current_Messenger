// Metro never actually loads this file — it always finds a more specific
// match first (LocationMapSurface.ios.tsx / .android.tsx / .web.tsx cover
// every platform this app targets). This bare file exists only so plain
// `tsc` module resolution (which, unlike Metro, doesn't know about RN's
// platform-suffix convention without a project-wide `moduleSuffixes`
// tsconfig change) can resolve the extensionless `./LocationMapSurface`
// import in MessageBubble.tsx. Re-exporting the web variant is arbitrary —
// this module's actual implementation is never reached at runtime.
export { LocationMapSurface } from './LocationMapSurface.web';
export type { LocationMapSurfaceProps } from './LocationMapSurface.ios';
