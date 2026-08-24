// FILE PURPOSE: Native (iOS/Android) implementation — thin re-export of
// react-native-video-trim. videoTrim.web.ts is the counterpart Metro
// picks on web (mirrors webrtc.ts/webrtc.web.ts's exact split, for the
// exact same reason): merely IMPORTING react-native-video-trim throws at
// module-evaluation time on web (confirmed live — its TurboModule spec
// module calls TurboModuleRegistry.getEnforcing() unconditionally at the
// top level, which has nothing to resolve against without a real native
// module registry), not just when one of its functions is actually
// called. A runtime Platform.OS check inside media.ts wouldn't help —
// the import itself is what crashes, before any check could run — so
// this has to be a separate file Metro's platform-suffix resolution
// keeps out of the web bundle graph entirely, same reasoning as the
// existing webrtc split.
export {
  default as VideoTrimNative,
  showEditor as showVideoTrimEditorNative,
  compress as compressVideoNative,
  type Spec as VideoTrimSpec,
} from 'react-native-video-trim';

export const VIDEO_TRIM_SUPPORTED = true;
