// FILE PURPOSE: Web stub — see videoTrim.ts's comment for why this split exists at all
// (importing react-native-video-trim crashes immediately on web, not
// just when called). Video sending isn't a real web flow in this app —
// web only exists here for layout-verification screenshots, same
// established scope as webrtc.web.ts — so these only need to fail
// clearly if ever reached, not actually work.
class UnsupportedOnWeb extends Error {
  constructor() {
    super('Video trim/compression is not supported on web in this app.');
  }
}

function unsupported(): never {
  throw new UnsupportedOnWeb();
}

export const VideoTrimNative = {
  onFinishTrimming: unsupported,
  onCancel: unsupported,
  onError: unsupported,
};

export const showVideoTrimEditorNative: (...args: any[]) => void = unsupported;

export const compressVideoNative: (...args: any[]) => Promise<{ outputPath: string }> = async () => unsupported();

export type VideoTrimSpec = typeof VideoTrimNative;

export const VIDEO_TRIM_SUPPORTED = false;
