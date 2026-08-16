// Web stub — Picture-in-Picture here is Android's native
// enterPictureInPictureMode, which has no web equivalent, and this app
// doesn't target web as a real platform (web only exists here for
// layout-verification screenshots). Matches the existing
// callAudio.ts/callAudio.web.ts and webrtc.ts/webrtc.web.ts platform-suffix
// split for the same reason.
export function isPipSupported(): boolean {
  return false;
}

export function setPipEligible(_eligible: boolean): void {}
