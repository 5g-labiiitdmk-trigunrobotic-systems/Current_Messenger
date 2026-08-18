import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import type { ServerEvent } from '../types/relay';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices, MediaStream } from '../lib/webrtc';
import { fetchIceServers, type IceServerConfig } from '../lib/iceServers';
import { useAuthStore } from './authStore';
import { useGroupStore } from './groupStore';
import { useCallStore } from './callStore';
import { startCallAudioSession, stopCallAudioSession, playIncomingRingtone, stopIncomingRingtone, playOutgoingRingback, stopOutgoingRingback } from '../lib/callAudio';

/**
 * Group calling — mesh topology, hard-capped at 4 participants. See
 * docs/GROUP_CALLING.md for the full architecture writeup (why mesh not
 * SFU, why the cap, what the relay already supports). This store is a
 * deliberately PARALLEL, INDEPENDENT path from callStore.ts (1:1 calling)
 * — not a shared/refactored base. The two stores never call into each
 * other's actions and don't share module-scope connection state; the only
 * coupling is a one-way read of each other's `phase` for busy-detection
 * (see wire()'s 'ring' handler below and the matching, minimal guard added
 * to callStore.ts).
 *
 * Mesh bootstrap protocol (no server-side call-session registry exists —
 * see docs/GROUP_CALLING.md's "what's NOT built" list from the prior
 * round, and this round's own report for why one wasn't added):
 *
 * 1. The initiator sends one `call:signal` (kind: 'ring') per target,
 *    exactly like a 1:1 ring, but with `groupId` set and the signal
 *    payload carrying `participantIds` — the FULL roster for this call
 *    (initiator included), so every recipient knows everyone else being
 *    invited, not just the caller.
 * 2. Whoever decides to join (the initiator, immediately; a callee, on
 *    accept) is "joined" locally and broadcasts `{kind:'accept'}` to
 *    EVERY OTHER roster member (not just whoever rang them) with the same
 *    groupId. This is what lets two callees who both accept discover each
 *    other without the initiator relaying anything.
 * 3. A pairwise connection is only created once BOTH sides are locally
 *    "joined" — for a callee, the initiator counts as already-joined the
 *    moment the callee itself joins (the ring's existence is itself
 *    evidence the initiator is participating); for any other peer,
 *    "joined" is learned from receiving their accept broadcast. Whichever
 *    side has the lexicographically LOWER userId creates the offer, the
 *    other waits for it — deterministic and glare-free without needing
 *    any join-order coordination.
 *
 * Known, deliberate limitation: a group member who was NOT in the
 * original up-to-4 ring set has no way to discover or join a call already
 * in progress — there is no server-side "who's currently in this group's
 * call" roster to query, and building one would mean extending relay
 * state beyond the signaling-only contract docs/GROUP_CALLING.md
 * describes as already sufficient. "Joining an in-progress call" in this
 * implementation means: accepting a ring you already received, whenever
 * you get to it (even after other invitees have already connected) — not
 * discovering a call you were never rung for.
 */

export const GROUP_CALL_CAP = 4; // initiator + up to 3 others — see docs/GROUP_CALLING.md
const RING_TIMEOUT_MS = 45_000;
const CONNECTING_TIMEOUT_MS = 30_000;
const ICE_DISCONNECT_GRACE_MS = 10_000;

export type GroupCallPhase = 'idle' | 'ringing-out' | 'ringing-in' | 'connecting' | 'active' | 'ended';
export type GroupCallEndReason = 'hangup' | 'all-declined' | 'no-answer' | 'network' | 'failed' | null;
export type ParticipantStatus = 'ringing' | 'connecting' | 'connected' | 'declined' | 'no-answer' | 'busy' | 'left' | 'failed';

export interface GroupCallParticipant {
  userId: string;
  isSelf: boolean;
  status: ParticipantStatus;
  stream: InstanceType<typeof MediaStream> | null;
}

interface IncomingGroupCall {
  groupId: string;
  from: string;
  kind: 'voice' | 'video';
  participantIds: string[]; // full roster, including the caller and self
}

type GroupCallSignal =
  | { kind: 'ring'; callKind: 'voice' | 'video'; participantIds: string[] }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'busy' }
  | { kind: 'timeout' }
  | { kind: 'hangup' }
  | { kind: 'offer'; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice-candidate'; candidate: unknown };

// zustand's real `set` accepts either a partial object or an updater
// function — the helper functions below need the updater form (to merge
// into nested `participants` without racing a stale closed-over `get()`
// snapshot), so this is the actual signature, not the narrower
// object-only one callStore.ts's equivalent helpers happen to only use.
type SetFn = (partial: Partial<GroupCallState> | ((state: GroupCallState) => Partial<GroupCallState>)) => void;

interface GroupCallState {
  phase: GroupCallPhase;
  groupId: string | null;
  kind: 'voice' | 'video' | null;
  incoming: IncomingGroupCall | null;
  participants: Record<string, GroupCallParticipant>;
  localStream: InstanceType<typeof MediaStream> | null;
  muted: boolean;
  cameraOff: boolean;
  endReason: GroupCallEndReason;
  connectedAt: number | null;
  wired: boolean;
  wire: () => void;
  startGroupCall: (groupId: string, kind: 'voice' | 'video') => void;
  accept: () => void;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  clearEnded: () => void;
}

// Module-scope connection plumbing — deliberately separate Maps from
// callStore.ts's single `pc`, `pendingRemoteCandidates`, etc. One entry
// per remote peer in this mesh, not one connection total.
const pcs = new Map<string, InstanceType<typeof RTCPeerConnection>>();
const pendingCandidates = new Map<string, unknown[]>();
const haveRemoteDescription = new Map<string, boolean>();
// Peers we know have decided to join this call (received their 'accept',
// or — for the initiator — implied by the ring itself once we ourselves
// join) but may not yet have a peer connection with us.
const readyPeers = new Set<string>();
const ringTimeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();
const connectingTimeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();
const iceDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
let endedResetTimer: ReturnType<typeof setTimeout> | null = null;
let selfJoined = false;
let localMediaPromise: Promise<void> | null = null;
let iceServers: IceServerConfig[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function sendSignal(to: string, groupId: string, signal: GroupCallSignal) {
  relayClient.send({ type: 'call:signal', to, groupId, signal: signal as unknown as Record<string, unknown> });
}

function broadcastSignal(targets: string[], self: string, groupId: string, signal: GroupCallSignal) {
  for (const id of targets) {
    if (id !== self) sendSignal(id, groupId, signal);
  }
}

function clearPeerTimers(peerId: string) {
  const rt = ringTimeoutTimers.get(peerId);
  if (rt) clearTimeout(rt);
  ringTimeoutTimers.delete(peerId);
  const ct = connectingTimeoutTimers.get(peerId);
  if (ct) clearTimeout(ct);
  connectingTimeoutTimers.delete(peerId);
  const it = iceDisconnectTimers.get(peerId);
  if (it) clearTimeout(it);
  iceDisconnectTimers.delete(peerId);
}

function closePeer(peerId: string) {
  clearPeerTimers(peerId);
  const pc = pcs.get(peerId);
  if (pc) {
    pc.getSenders().forEach((s) => s.track?.stop());
    pc.close();
  }
  pcs.delete(peerId);
  pendingCandidates.delete(peerId);
  haveRemoteDescription.delete(peerId);
  readyPeers.delete(peerId);
}

function teardownAll() {
  if (endedResetTimer) {
    clearTimeout(endedResetTimer);
    endedResetTimer = null;
  }
  stopIncomingRingtone();
  stopOutgoingRingback();
  stopCallAudioSession();
  for (const peerId of Array.from(pcs.keys())) closePeer(peerId);
  for (const peerId of Array.from(ringTimeoutTimers.keys())) clearPeerTimers(peerId);
  readyPeers.clear();
  selfJoined = false;
  localMediaPromise = null;
}

/**
 * Every roster member this device isn't already connected/connecting to,
 * but has marked ready (see readyPeers), gets a peer connection created —
 * only once we ourselves have joined and have local media. Called after
 * joining and after every new 'accept' received.
 */
async function tryConnectReadyPeers(get: () => GroupCallState, set: SetFn) {
  if (!selfJoined) return;
  const self = useAuthStore.getState().session?.user.id;
  const groupId = get().groupId;
  if (!self || !groupId) return;

  const toConnect = Array.from(readyPeers).filter((id) => !pcs.has(id));
  if (toConnect.length === 0) return;

  try {
    await ensureLocalMedia(get, set);
  } catch {
    endGroupCall(get, set, 'failed');
    return;
  }

  for (const peerId of toConnect) {
    const pc = createPeerConnection(peerId, get, set);
    pcs.set(peerId, pc);
    set((s) => ({ participants: { ...s.participants, [peerId]: { userId: peerId, isSelf: false, status: 'connecting', stream: s.participants[peerId]?.stream ?? null } } }));
    startPeerConnectingTimeout(peerId, get, set);
    // Lower userId always offers — see this file's top-of-file comment.
    // Deterministic regardless of join order, avoids both sides racing to
    // create an offer at once (glare).
    if (self < peerId) {
      try {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        sendSignal(peerId, groupId, { kind: 'offer', sdp: offer.sdp! });
      } catch {
        markPeerFailed(peerId, get, set);
      }
    }
    // else: wait for their offer (they'll send one once they see us as ready).
  }
}

function createPeerConnection(peerId: string, get: () => GroupCallState, set: SetFn) {
  const pc = new RTCPeerConnection({ iceServers });
  const localStream = get().localStream;
  localStream?.getTracks().forEach((track: any) => pc.addTrack(track, localStream as any));

  // See callStore.ts's identical comment: react-native-webrtc's typings
  // lag its actual runtime API for addEventListener under this project's
  // TS version — same narrow `as any`, not a new gap this file introduces.
  const pcEvents = pc as any;
  const groupId = get().groupId;

  pcEvents.addEventListener('icecandidate', (e: any) => {
    if (e.candidate && groupId) {
      sendSignal(peerId, groupId, { kind: 'ice-candidate', candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
    }
  });

  pcEvents.addEventListener('track', (e: any) => {
    const remote = e.streams?.[0] ?? null;
    if (remote) {
      set((s) => ({ participants: { ...s.participants, [peerId]: { userId: peerId, isSelf: false, status: s.participants[peerId]?.status ?? 'connecting', stream: remote } } }));
    }
  });

  pcEvents.addEventListener('connectionstatechange', () => {
    const state = pc.connectionState;
    if (state === 'connected') {
      const ct = connectingTimeoutTimers.get(peerId);
      if (ct) clearTimeout(ct);
      connectingTimeoutTimers.delete(peerId);
      set((s) => ({
        participants: { ...s.participants, [peerId]: { ...(s.participants[peerId] ?? { userId: peerId, isSelf: false, stream: null }), status: 'connected' } },
        // Any peer reaching 'connected' means the call itself is live —
        // idle/ended are terminal states this shouldn't resurrect (a late
        // event arriving just after hangup/teardown).
        phase: s.phase === 'idle' || s.phase === 'ended' ? s.phase : 'active',
        connectedAt: s.connectedAt ?? Date.now(),
      }));
      stopOutgoingRingback();
      stopIncomingRingtone();
    } else if (state === 'failed') {
      markPeerFailed(peerId, get, set);
    }
  });

  pcEvents.addEventListener('iceconnectionstatechange', () => {
    const state = pc.iceConnectionState;
    if (state === 'disconnected') {
      const existing = iceDisconnectTimers.get(peerId);
      if (existing) clearTimeout(existing);
      iceDisconnectTimers.set(
        peerId,
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') markPeerFailed(peerId, get, set);
        }, ICE_DISCONNECT_GRACE_MS)
      );
    } else if (state === 'connected' || state === 'completed') {
      const existing = iceDisconnectTimers.get(peerId);
      if (existing) clearTimeout(existing);
      iceDisconnectTimers.delete(peerId);
    } else if (state === 'failed') {
      markPeerFailed(peerId, get, set);
    }
  });

  return pc;
}

function startPeerConnectingTimeout(peerId: string, get: () => GroupCallState, set: SetFn) {
  const existing = connectingTimeoutTimers.get(peerId);
  if (existing) clearTimeout(existing);
  connectingTimeoutTimers.set(
    peerId,
    setTimeout(() => {
      connectingTimeoutTimers.delete(peerId);
      const pc = pcs.get(peerId);
      if (pc && pc.connectionState !== 'connected') {
        // eslint-disable-next-line no-console
        console.warn(`[groupCallStore] peer ${peerId} never finished connecting after ${CONNECTING_TIMEOUT_MS}ms (state: ${pc.connectionState}) — dropping just this peer, not the whole call.`);
        markPeerFailed(peerId, get, set);
      }
    }, CONNECTING_TIMEOUT_MS)
  );
}

/** One peer failing doesn't end the call for everyone else still connected — only ends the call overall if this was the last remaining peer. */
function markPeerFailed(peerId: string, get: () => GroupCallState, set: SetFn) {
  closePeer(peerId);
  set((s) => ({ participants: { ...s.participants, [peerId]: { ...(s.participants[peerId] ?? { userId: peerId, isSelf: false, stream: null }), status: 'failed', stream: null } } }));
  maybeEndIfAlone(get, set);
}

function maybeEndIfAlone(get: () => GroupCallState, set: SetFn) {
  const s = get();
  if (s.phase !== 'active' && s.phase !== 'connecting') return;
  const stillWith = Object.values(s.participants).filter((p) => !p.isSelf && (p.status === 'connected' || p.status === 'connecting' || p.status === 'ringing'));
  if (stillWith.length === 0) endGroupCall(get, set, 'hangup');
}

async function ensureLocalMedia(get: () => GroupCallState, set: SetFn) {
  if (get().localStream) return;
  if (localMediaPromise) return localMediaPromise;
  localMediaPromise = (async () => {
    const kind = get().kind;
    const stream = await mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
    set({ localStream: stream as any });
    startCallAudioSession(kind === 'video' ? 'video' : 'audio');
    const self = useAuthStore.getState().session?.user.id;
    if (self) {
      set((s) => ({ participants: { ...s.participants, [self]: { userId: self, isSelf: true, status: 'connected', stream: null } } }));
    }
  })();
  return localMediaPromise;
}

export const useGroupCallStore = create<GroupCallState>((set, get) => ({
  phase: 'idle',
  groupId: null,
  kind: null,
  incoming: null,
  participants: {},
  localStream: null,
  muted: false,
  cameraOff: false,
  endReason: null,
  connectedAt: null,
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });
    fetchIceServers().then((servers) => {
      iceServers = servers;
    });

    relayClient.on(async (event: ServerEvent) => {
      if (event.type !== 'call:signal' || !event.groupId) return;
      const signal = event.signal as unknown as GroupCallSignal;
      const from = event.from;
      const groupId = event.groupId;
      const self = useAuthStore.getState().session?.user.id;

      switch (signal.kind) {
        case 'ring': {
          const s = get();
          if (s.phase === 'ringing-in' && s.incoming?.groupId === groupId && s.incoming?.from === from) break; // duplicate/replayed ring
          const alreadyBusy = s.phase !== 'idle' || useCallStore.getState().phase !== 'idle';
          if (alreadyBusy) {
            sendSignal(from, groupId, { kind: 'busy' });
            return;
          }
          const participants: Record<string, GroupCallParticipant> = {};
          for (const id of signal.participantIds) {
            if (id === self) continue;
            participants[id] = { userId: id, isSelf: false, status: 'ringing', stream: null };
          }
          set({
            phase: 'ringing-in',
            groupId,
            kind: signal.callKind,
            incoming: { groupId, from, kind: signal.callKind, participantIds: signal.participantIds },
            participants,
            endReason: null,
          });
          playIncomingRingtone();
          break;
        }
        case 'accept': {
          const s = get();
          if (s.groupId !== groupId || !s.participants[from]) return;
          set((st) => ({ participants: { ...st.participants, [from]: { ...st.participants[from], status: 'connecting' } } }));
          readyPeers.add(from);
          await tryConnectReadyPeers(get, set);
          break;
        }
        case 'offer': {
          const s = get();
          if (s.groupId !== groupId) return;
          try {
            let pc = pcs.get(from);
            if (!pc) {
              await ensureLocalMedia(get, set);
              pc = createPeerConnection(from, get, set);
              pcs.set(from, pc);
              startPeerConnectingTimeout(from, get, set);
              set((st) => ({ participants: { ...st.participants, [from]: { ...(st.participants[from] ?? { userId: from, isSelf: false, stream: null }), status: 'connecting' } } }));
            }
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            haveRemoteDescription.set(from, true);
            await flushPendingCandidates(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(from, groupId, { kind: 'answer', sdp: answer.sdp! });
          } catch {
            markPeerFailed(from, get, set);
          }
          break;
        }
        case 'answer': {
          const pc = pcs.get(from);
          if (!pc) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            haveRemoteDescription.set(from, true);
            await flushPendingCandidates(from);
          } catch {
            markPeerFailed(from, get, set);
          }
          break;
        }
        case 'ice-candidate': {
          const pc = pcs.get(from);
          if (!pc) return;
          if (!haveRemoteDescription.get(from)) {
            const queue = pendingCandidates.get(from) ?? [];
            queue.push(signal.candidate);
            pendingCandidates.set(from, queue);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate as any));
            } catch {
              // stray/late candidate — not fatal
            }
          }
          break;
        }
        case 'decline':
        case 'busy':
        case 'timeout': {
          const s = get();
          if (s.groupId !== groupId || !s.participants[from]) return;
          const status: ParticipantStatus = signal.kind === 'decline' ? 'declined' : signal.kind === 'busy' ? 'busy' : 'no-answer';
          set((st) => ({ participants: { ...st.participants, [from]: { ...st.participants[from], status } } }));
          clearPeerTimers(from);
          maybeEndIfAllUnanswered(get, set);
          break;
        }
        case 'hangup': {
          const s = get();
          if (s.groupId !== groupId) return;
          // The initiator canceling before we've even responded (still
          // ringing-in, never joined) — dismiss our ring entirely, same as
          // 1:1 calling's unconditional endCall() on a caller's hangup at
          // any phase. Not the same as some OTHER invitee leaving while
          // we're still deciding, which shouldn't cancel our own ring —
          // only the person who actually rang us can do that.
          if (s.phase === 'ringing-in' && s.incoming?.from === from) {
            stopIncomingRingtone();
            set({ phase: 'idle', incoming: null, groupId: null, kind: null, participants: {} });
            break;
          }
          closePeer(from);
          set((st) => ({ participants: { ...st.participants, [from]: { ...(st.participants[from] ?? { userId: from, isSelf: false, stream: null }), status: 'left', stream: null } } }));
          maybeEndIfAlone(get, set);
          break;
        }
        default:
          break;
      }
    });
  },

  startGroupCall: (groupId, kind) => {
    if (get().phase !== 'idle' || useCallStore.getState().phase !== 'idle') return;
    const self = useAuthStore.getState().session?.user.id;
    const group = useGroupStore.getState().groups[groupId];
    if (!self || !group) return;

    const others = group.memberIds.filter((id) => id !== self).slice(0, GROUP_CALL_CAP - 1);
    if (others.length === 0) return;
    const participantIds = [self, ...others];

    fetchIceServers().then((servers) => {
      iceServers = servers;
    });

    const participants: Record<string, GroupCallParticipant> = { [self]: { userId: self, isSelf: true, status: 'connected', stream: null } };
    for (const id of others) participants[id] = { userId: id, isSelf: false, status: 'ringing', stream: null };

    set({ phase: 'ringing-out', groupId, kind, participants, endReason: null, connectedAt: null });
    selfJoined = true;
    playOutgoingRingback();

    for (const target of others) {
      sendSignal(target, groupId, { kind: 'ring', callKind: kind, participantIds });
      ringTimeoutTimers.set(
        target,
        setTimeout(() => {
          ringTimeoutTimers.delete(target);
          if (get().groupId !== groupId) return;
          sendSignal(target, groupId, { kind: 'timeout' });
          set((s) => ({ participants: { ...s.participants, [target]: { ...s.participants[target], status: 'no-answer' } } }));
          maybeEndIfAllUnanswered(get, set);
        }, RING_TIMEOUT_MS)
      );
    }
  },

  accept: async () => {
    const s = get();
    if (s.phase !== 'ringing-in' || !s.incoming) return;
    const { groupId, from, participantIds } = s.incoming;
    stopIncomingRingtone();
    const self = useAuthStore.getState().session?.user.id;
    fetchIceServers().then((servers) => {
      iceServers = servers;
    });
    set({ phase: 'connecting', incoming: null });
    selfJoined = true;
    if (self) readyPeers.add(from); // the caller's own existence is evidence they've joined — see top-of-file comment
    broadcastSignal(participantIds, self ?? '', groupId, { kind: 'accept' });
    try {
      await tryConnectReadyPeers(get, set);
    } catch {
      endGroupCall(get, set, 'failed');
    }
  },

  decline: () => {
    const s = get();
    if (!s.incoming) return;
    const { groupId, participantIds } = s.incoming;
    const self = useAuthStore.getState().session?.user.id ?? '';
    broadcastSignal(participantIds, self, groupId, { kind: 'decline' });
    stopIncomingRingtone();
    set({ phase: 'idle', incoming: null, groupId: null, kind: null, participants: {} });
  },

  hangup: () => {
    endGroupCall(get, set, 'hangup');
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

  clearEnded: () => {
    if (endedResetTimer) {
      clearTimeout(endedResetTimer);
      endedResetTimer = null;
    }
    set({ phase: 'idle', groupId: null, kind: null, endReason: null, localStream: null, participants: {}, muted: false, cameraOff: false, connectedAt: null });
  },
}));

async function flushPendingCandidates(peerId: string) {
  const pc = pcs.get(peerId);
  if (!pc) return;
  const queued = pendingCandidates.get(peerId) ?? [];
  pendingCandidates.set(peerId, []);
  for (const candidate of queued) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate as any));
    } catch {
      // ignore
    }
  }
}

/** Ends the call if every OTHER target has resolved unsuccessfully and no one ever connected — i.e. the call never really started. */
function maybeEndIfAllUnanswered(get: () => GroupCallState, set: SetFn) {
  const s = get();
  if (s.phase !== 'ringing-out' && s.phase !== 'connecting') return;
  const others = Object.values(s.participants).filter((p) => !p.isSelf);
  const anyStillPending = others.some((p) => p.status === 'ringing' || p.status === 'connecting' || p.status === 'connected');
  if (!anyStillPending && others.length > 0) endGroupCall(get, set, 'all-declined');
}

function endGroupCall(get: () => GroupCallState, set: SetFn, reason: GroupCallEndReason) {
  const s = get();
  const groupId = s.groupId;
  const self = useAuthStore.getState().session?.user.id;
  // Tell everyone we were still connected/ringing with that we're leaving —
  // a target who never answered yet still gets a 'hangup' so their ring
  // clears rather than sitting until their own 45s timeout.
  if (groupId && self) {
    for (const p of Object.values(s.participants)) {
      if (!p.isSelf && (p.status === 'ringing' || p.status === 'connecting' || p.status === 'connected')) {
        sendSignal(p.userId, groupId, { kind: 'hangup' });
      }
    }
  }
  teardownAll();
  set({
    phase: 'ended',
    endReason: reason,
    incoming: null,
    localStream: null,
    muted: false,
    cameraOff: false,
  });
  endedResetTimer = setTimeout(() => {
    endedResetTimer = null;
    if (get().phase === 'ended') {
      set({ phase: 'idle', groupId: null, kind: null, endReason: null, localStream: null, participants: {}, muted: false, cameraOff: false, connectedAt: null });
    }
  }, 2500);
}
