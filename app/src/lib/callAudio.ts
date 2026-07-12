// Native (iOS/Android) call-audio routing + ringtone, via
// react-native-incall-manager — the companion library to react-native-webrtc
// for exactly this (speaker/earpiece/Bluetooth routing, proximity sensor,
// ringtone/ringback playback). react-native-webrtc itself has no JS API for
// any of this; it only carries the media streams.
//
// This replaces callStore.ts's old toggleSpeaker, whose own comment openly
// admitted it "doesn't yet force the OS audio route" — it only flipped a UI
// boolean, so a call was very plausibly always actually routing through the
// earpiece regardless of what the speaker toggle showed, which is the most
// likely explanation for "speaker volume is too low": it probably wasn't in
// speaker mode at the OS level at all.
import { DeviceEventEmitter } from 'react-native';
import InCallManager from 'react-native-incall-manager';

export type AudioRoute = 'EARPIECE' | 'SPEAKER_PHONE' | 'WIRED_HEADSET' | 'BLUETOOTH';

export interface AudioRouteState {
  availableRoutes: AudioRoute[];
  selectedRoute: AudioRoute | null;
}

const EMPTY_STATE: AudioRouteState = { availableRoutes: [], selectedRoute: null };

function parseStatus(raw: any): AudioRouteState {
  let availableRoutes: AudioRoute[] = [];
  try {
    const parsed = JSON.parse(raw?.availableAudioDeviceList ?? '[]');
    if (Array.isArray(parsed)) availableRoutes = parsed;
  } catch {
    availableRoutes = [];
  }
  const selectedRoute = (raw?.selectedAudioDevice || null) as AudioRoute | null;
  return { availableRoutes, selectedRoute };
}

/**
 * Starts the native in-call audio session — proximity sensor, correct
 * default route (earpiece for a voice call, speaker for video, matching
 * every standard phone dialer), and Bluetooth/wired-headset detection.
 * Call once when a call becomes active (startLocalMedia in callStore.ts);
 * stopCallAudioSession() tears it down at call end. The native module
 * doesn't track audio devices or emit route-change events until a session
 * is actually running, so this must happen before chooseAudioRoute() or
 * subscribeToAudioRouteChanges() mean anything.
 */
export function startCallAudioSession(media: 'audio' | 'video') {
  InCallManager.start({ media, auto: true });
}

export function stopCallAudioSession() {
  InCallManager.stop();
}

/** Forces a specific audio route — the actual OS-level routing change the
 * old speaker toggle never made. Resolves with the post-change state so
 * the caller doesn't have to wait for a separate change event to reflect it. */
export async function chooseAudioRoute(route: AudioRoute): Promise<AudioRouteState> {
  const raw = await InCallManager.chooseAudioRoute(route);
  return parseStatus(raw);
}

/**
 * Fires whenever the set of available routes or the active route changes —
 * a Bluetooth headset connecting/disconnecting mid-call, a wired headset
 * being plugged in, etc. — so the in-call route picker can update live,
 * the same way a real phone dialer's does. Returns an unsubscribe function.
 */
export function subscribeToAudioRouteChanges(cb: (state: AudioRouteState) => void): () => void {
  const sub = DeviceEventEmitter.addListener('onAudioDeviceChanged', (raw: any) => cb(parseStatus(raw)));
  return () => sub.remove();
}

/** Best-effort initial snapshot — there's no direct "get current state"
 * native call, only the event stream and chooseAudioRoute()'s own return
 * value, so callers should treat this as a placeholder until the first
 * onAudioDeviceChanged event (or their own chooseAudioRoute call) arrives. */
export function getInitialAudioRouteState(): AudioRouteState {
  return EMPTY_STATE;
}

/**
 * Plays an actual local ringtone, looping, for an incoming call — separate
 * from (and not dependent on) the OS push notification's own sound, which
 * only applies while the app is backgrounded/killed. When the app is open
 * and showing the incoming-call screen, nothing was playing any sound at
 * all before this. Vibration pattern matches the 'calls' push notification
 * channel's (see src/lib/push.ts) for a consistent feel regardless of
 * which path actually alerted the user.
 */
export function playIncomingRingtone() {
  InCallManager.startRingtone('_DEFAULT_', [0, 250, 250, 250], 'default', -1); // seconds=-1: loop until stopIncomingRingtone() (Android; iOS loops regardless)
}

export function stopIncomingRingtone() {
  InCallManager.stopRingtone();
}

export const CALL_AUDIO_SUPPORTED = true;
