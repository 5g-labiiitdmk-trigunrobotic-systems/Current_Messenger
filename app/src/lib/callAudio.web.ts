// Web stub — react-native-incall-manager is native-only (Android/iOS
// device audio routing has no web equivalent) and this app doesn't target
// web as a real platform (web only exists here for layout-verification
// screenshots). Metro picks this file over callAudio.ts automatically for
// web bundles via its platform-suffix resolution, so the native module is
// never pulled into the web bundle graph — matches the existing
// webrtc.ts/webrtc.web.ts split for the same reason.
export type AudioRoute = 'EARPIECE' | 'SPEAKER_PHONE' | 'WIRED_HEADSET' | 'BLUETOOTH';

export interface AudioRouteState {
  availableRoutes: AudioRoute[];
  selectedRoute: AudioRoute | null;
}

export function startCallAudioSession(_media: 'audio' | 'video') {}
export function stopCallAudioSession() {}
export async function chooseAudioRoute(_route: AudioRoute): Promise<AudioRouteState> {
  return { availableRoutes: [], selectedRoute: null };
}
export function subscribeToAudioRouteChanges(_cb: (state: AudioRouteState) => void): () => void {
  return () => {};
}
export function getInitialAudioRouteState(): AudioRouteState {
  return { availableRoutes: [], selectedRoute: null };
}
export function playIncomingRingtone() {}
export function stopIncomingRingtone() {}

export const CALL_AUDIO_SUPPORTED = false;
