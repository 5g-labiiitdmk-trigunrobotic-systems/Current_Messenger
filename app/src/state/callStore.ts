import { create } from 'zustand';
import { AppState } from 'react-native';
import { relayClient } from '../lib/relayClient';
import type { ServerEvent } from '../types/relay';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices, MediaStream } from '../lib/webrtc';
import { fetchIceServers, type IceServerConfig } from '../lib/iceServers';

export interface CallLogEntry {
  id: string;
  peerId: string;
  direction: 'in' | 'out' | 'missed';
  kind: 'voice' | 'video';
  at: string;
  durationSec?: number;
}

interface IncomingCall {
  from: string;
  kind: 'voice' | 'video';
}

export type CallPhase = 'idle' | 'ringing-out' | 'ringing-in' | 'connecting' | 'active' | 'ended';
export type CallEndReason = 'hangup' | 'declined' | 'busy' | 'no-answer' | 'network' | 'failed' | null;

type CallSignal =
  | { kind: 'ring'; callKind: 'voice' | 'video' }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'busy' }
  | { kind: 'timeout' }
  | { kind: 'hangup' }
  | { kind: 'offer'; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice-candidate'; candidate: unknown };

interface CallState {
  log: CallLogEntry[]; // session-only, never persisted
  incoming: IncomingCall | null;
  phase: CallPhase;
  peerId: string | null;
  kind: 'voice' | 'video' | null;
  endReason: CallEndReason;
  localStream: InstanceType<typeof MediaStream> | null;
  remoteStream: InstanceType<typeof MediaStream> | null;
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  connectedAt: number | null;
  wired: boolean;
  wire: () => void;
  ring: (to: string, kind: 'voice' | 'video') => void;
  accept: () => void;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  clearEnded: () => void;
}

const RING_TIMEOUT_MS = 45_000;
const ICE_DISCONNECT_GRACE_MS = 10_000;

// Module-scope, not store state — pure connection plumbing that has no
// business being serialized/observed by React. Reset on every call end.
let pc: InstanceType<typeof RTCPeerConnection> | null = null;
let iceServers: IceServerConfig[] = [{ urls: 'stun:stun.l.google.com:19302' }];
let pendingRemoteCandidates: unknown[] = [];
let haveRemoteDescription = false;
let ringTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let iceDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: { remove: () => void } | null = null;

function clearTimers() {
  if (ringTimeoutTimer) clearTimeout(ringTimeoutTimer);
  if (iceDisconnectTimer) clearTimeout(iceDisconnectTimer);
  ringTimeoutTimer = null;
  iceDisconnectTimer = null;
}

function sendSignal(to: string, signal: CallSignal) {
  relayClient.send({ type: 'call:signal', to, signal: signal as unknown as Record<string, unknown> });
}

function teardownConnection() {
  clearTimers();
  if (pc) {
    // react-native-webrtc's close() also stops remote tracks; local tracks
    // are ours to stop explicitly so the camera/mic light actually turns off.
    pc.getSenders().forEach((s) => s.track?.stop());
    pc.close();
    pc = null;
  }
  pendingRemoteCandidates = [];
  haveRemoteDescription = false;
  appStateSub?.remove();
  appStateSub = null;
}

/**
 * Real WebRTC audio/video on top of the existing relay-based signaling.
 * Offer/answer/ICE candidates ride the same call:signal wire message that
 * ring/accept/decline already used — no new signaling channel. The relay
 * still enforces contact-approval on every call:signal (see
 * server/src/index.ts), so this inherits that gate for free.
 *
 * Known limitation: if either app is backgrounded mid-call, the OS may
 * throttle or suspend the JS engine (especially on iOS) since there's no
 * CallKit/ConnectionService integration here — that requires native VoIP
 * push entitlements and is a separate, substantial follow-up, not
 * implemented in this pass. Calls will generally survive brief
 * backgrounding but aren't guaranteed to for extended periods.
 */
export const useCallStore = create<CallState>((set, get) => ({
  log: [],
  incoming: null,
  phase: 'idle',
  peerId: null,
  kind: null,
  endReason: null,
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  speakerOn: false,
  connectedAt: null,
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });
    fetchIceServers().then((servers) => {
      iceServers = servers;
    });

    relayClient.on(async (event: ServerEvent) => {
      if (event.type !== 'call:signal') return;
      const signal = event.signal as unknown as CallSignal;
      const from = event.from;

      switch (signal.kind) {
        case 'ring': {
          const s = get();
          if (s.phase !== 'idle') {
            // Already on a call — tell the caller instead of silently
            // dropping their ring, and don't touch our current call state.
            sendSignal(from, { kind: 'busy' });
            return;
          }
          set({
            phase: 'ringing-in',
            incoming: { from, kind: signal.callKind },
            peerId: from,
            kind: signal.callKind,
            endReason: null,
            log: [{ id: `${Date.now()}`, peerId: from, direction: 'in', kind: signal.callKind, at: new Date().toISOString() }, ...s.log],
          });
          break;
        }
        case 'accept': {
          if (get().phase !== 'ringing-out' || get().peerId !== from) return;
          clearTimers();
          set({ phase: 'connecting' });
          try {
            await startLocalMedia(get, set);
            const offer = await pc!.createOffer({});
            await pc!.setLocalDescription(offer);
            sendSignal(from, { kind: 'offer', sdp: offer.sdp! });
          } catch (e) {
            endCall(get, set, 'failed');
          }
          break;
        }
        case 'offer': {
          if (get().phase !== 'connecting' || get().peerId !== from) return;
          try {
            await pc!.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            haveRemoteDescription = true;
            await flushPendingCandidates();
            const answer = await pc!.createAnswer();
            await pc!.setLocalDescription(answer);
            sendSignal(from, { kind: 'answer', sdp: answer.sdp! });
          } catch {
            endCall(get, set, 'failed');
          }
          break;
        }
        case 'answer': {
          if (get().peerId !== from || !pc) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            haveRemoteDescription = true;
            await flushPendingCandidates();
          } catch {
            endCall(get, set, 'failed');
          }
          break;
        }
        case 'ice-candidate': {
          if (get().peerId !== from || !pc) return;
          if (!haveRemoteDescription) {
            pendingRemoteCandidates.push(signal.candidate);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate as any));
            } catch {
              // A stray/late candidate failing to add isn't fatal to the call.
            }
          }
          break;
        }
        case 'decline': {
          if (get().peerId !== from) return;
          endCall(get, set, 'declined');
          break;
        }
        case 'busy': {
          if (get().peerId !== from) return;
          endCall(get, set, 'busy');
          break;
        }
        case 'timeout': {
          if (get().peerId !== from) return;
          endCall(get, set, 'no-answer');
          break;
        }
        case 'hangup': {
          if (get().peerId !== from) return;
          endCall(get, set, 'hangup');
          break;
        }
        default:
          break;
      }
    });
  },

  ring: (to, kind) => {
    if (get().phase !== 'idle') return; // already mid-call — ignore
    fetchIceServers().then((servers) => {
      iceServers = servers;
    });
    set((s) => ({
      phase: 'ringing-out',
      peerId: to,
      kind,
      endReason: null,
      log: [{ id: `${Date.now()}`, peerId: to, direction: 'out', kind, at: new Date().toISOString() }, ...s.log],
    }));
    sendSignal(to, { kind: 'ring', callKind: kind });
    ringTimeoutTimer = setTimeout(() => {
      if (get().phase !== 'ringing-out') return;
      const to2 = get().peerId;
      if (to2) sendSignal(to2, { kind: 'timeout' });
      endCall(get, set, 'no-answer');
    }, RING_TIMEOUT_MS);
  },

  accept: async () => {
    const s = get();
    if (s.phase !== 'ringing-in' || !s.peerId) return;
    clearTimers();
    set({ phase: 'connecting', incoming: null });
    sendSignal(s.peerId, { kind: 'accept' });
    try {
      await startLocalMedia(get, set);
      // The offer arrives shortly via the 'offer' handler above — nothing
      // more to do here until then.
    } catch {
      endCall(get, set, 'failed');
    }
  },

  decline: () => {
    const from = get().peerId;
    if (from) sendSignal(from, { kind: 'decline' });
    set({ phase: 'idle', incoming: null, peerId: null, kind: null });
  },

  hangup: () => {
    const peerId = get().peerId;
    if (peerId) sendSignal(peerId, { kind: 'hangup' });
    endCall(get, set, 'hangup');
  },

  toggleMute: () => {
    const s = get();
    const next = !s.muted;
    s.localStream?.getAudioTracks().forEach((t: any) => (t.enabled = !next));
    set({ muted: next });
  },

  toggleCamera: () => {
    const s = get();
    const next = !s.cameraOff;
    s.localStream?.getVideoTracks().forEach((t: any) => (t.enabled = !next));
    set({ cameraOff: next });
  },

  toggleSpeaker: () => {
    // react-native-webrtc's audio routing (InCallManager-style speaker
    // toggle) is a native-module call outside webrtc.ts's re-exported
    // surface — tracked as follow-up; this flips the UI/intent state so the
    // control isn't dead, but doesn't yet force the OS audio route.
    set((s) => ({ speakerOn: !s.speakerOn }));
  },

  clearEnded: () => {
    set({ phase: 'idle', peerId: null, kind: null, endReason: null, localStream: null, remoteStream: null, muted: false, cameraOff: false, connectedAt: null });
  },
}));

async function startLocalMedia(get: () => CallState, set: (partial: Partial<CallState>) => void) {
  const kind = get().kind;
  const stream = await mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
  set({ localStream: stream as any });

  pc = new RTCPeerConnection({ iceServers });
  stream.getTracks().forEach((track: any) => pc!.addTrack(track, stream as any));

  // react-native-webrtc's RTCPeerConnection.d.ts was built with TS 4.6 and
  // doesn't surface its event-target-shim-mixed-in addEventListener under
  // this project's newer TypeScript — the method exists and works fine at
  // runtime (confirmed against the library's own source), it's purely a
  // stale-typings gap, hence the narrow `as any` here rather than elsewhere.
  const pcEvents = pc as any;

  pcEvents.addEventListener('icecandidate', (e: any) => {
    const peerId = get().peerId;
    if (e.candidate && peerId) sendSignal(peerId, { kind: 'ice-candidate', candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
  });

  pcEvents.addEventListener('track', (e: any) => {
    const remote = e.streams?.[0] ?? null;
    if (remote) set({ remoteStream: remote });
  });

  pcEvents.addEventListener('connectionstatechange', () => {
    const state = pc?.connectionState;
    if (state === 'connected' && get().phase === 'connecting') {
      set({ phase: 'active', connectedAt: Date.now() });
    } else if (state === 'failed') {
      endCall(get, set, 'network');
    }
  });

  pcEvents.addEventListener('iceconnectionstatechange', () => {
    const state = pc?.iceConnectionState;
    if (state === 'disconnected') {
      // WebRTC often self-heals a transient 'disconnected' — give it a
      // grace window before treating the drop as fatal, rather than
      // hanging up on every brief network blip.
      if (iceDisconnectTimer) clearTimeout(iceDisconnectTimer);
      iceDisconnectTimer = setTimeout(() => {
        if (pc?.iceConnectionState === 'disconnected') endCall(get, set, 'network');
      }, ICE_DISCONNECT_GRACE_MS);
    } else if (state === 'connected' || state === 'completed') {
      if (iceDisconnectTimer) clearTimeout(iceDisconnectTimer);
      iceDisconnectTimer = null;
    } else if (state === 'failed') {
      endCall(get, set, 'network');
    }
  });

  appStateSub = AppState.addEventListener('change', () => {
    // Best-effort only — see the module-level doc comment on
    // useCallStore about background-call limitations without CallKit.
  });
}

async function flushPendingCandidates() {
  if (!pc) return;
  const queued = pendingRemoteCandidates;
  pendingRemoteCandidates = [];
  for (const candidate of queued) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate as any));
    } catch {
      // ignore — see addIceCandidate handling above
    }
  }
}

function endCall(get: () => CallState, set: (partial: Partial<CallState>) => void, reason: CallEndReason) {
  teardownConnection();
  const s = get();
  // Only relabel an inbound entry as "missed" — an outbound call that rang
  // out unanswered is still "out" from the caller's own perspective, not
  // "missed" (that label means "you didn't answer this").
  const log =
    reason === 'no-answer' && s.log[0]?.peerId === s.peerId && s.log[0]?.direction === 'in'
      ? [{ ...s.log[0], direction: 'missed' as const }, ...s.log.slice(1)]
      : s.log;
  set({
    phase: 'ended',
    endReason: reason,
    incoming: null,
    localStream: null,
    remoteStream: null,
    muted: false,
    cameraOff: false,
    log,
  });
}
