import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import type { ServerEvent } from '../types/relay';

export interface CallLogEntry {
  id: string;
  peerId: string;
  direction: 'in' | 'out' | 'missed';
  kind: 'voice' | 'video';
  at: string;
}

interface IncomingCall {
  from: string;
  kind: 'voice' | 'video';
}

interface CallState {
  log: CallLogEntry[]; // session-only, never persisted
  incoming: IncomingCall | null;
  wired: boolean;
  wire: () => void;
  ring: (to: string, kind: 'voice' | 'video') => void;
  accept: () => void;
  decline: () => void;
  hangup: (peerId: string) => void;
}

/**
 * Signaling only — this wires real "ring / accept / decline" events through
 * the relay so calling genuinely reaches the other device, but does not
 * implement WebRTC audio/video transport (a separate, large subsystem).
 * The incoming-call screen is fully functional as a live ring UI; there's
 * no audio stream once "accepted" yet.
 */
export const useCallStore = create<CallState>((set, get) => ({
  log: [],
  incoming: null,
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });
    relayClient.on((event: ServerEvent) => {
      if (event.type === 'call:signal') {
        const signal = event.signal as { kind?: 'ring' | 'accept' | 'decline' | 'hangup'; callKind?: 'voice' | 'video' };
        if (signal.kind === 'ring') {
          set({ incoming: { from: event.from, kind: signal.callKind ?? 'voice' } });
          set((s) => ({ log: [{ id: `${Date.now()}`, peerId: event.from, direction: 'in', kind: signal.callKind ?? 'voice', at: new Date().toISOString() }, ...s.log] }));
        }
        if (signal.kind === 'decline' || signal.kind === 'hangup') {
          set({ incoming: null });
        }
      }
    });
  },

  ring: (to, kind) => {
    relayClient.send({ type: 'call:signal', to, signal: { kind: 'ring', callKind: kind } });
    set((s) => ({ log: [{ id: `${Date.now()}`, peerId: to, direction: 'out', kind, at: new Date().toISOString() }, ...s.log] }));
  },

  accept: () => {
    const from = get().incoming?.from;
    if (from) relayClient.send({ type: 'call:signal', to: from, signal: { kind: 'accept' } });
    set({ incoming: null });
  },

  decline: () => {
    const from = get().incoming?.from;
    if (from) relayClient.send({ type: 'call:signal', to: from, signal: { kind: 'decline' } });
    set({ incoming: null });
  },

  hangup: (peerId) => {
    relayClient.send({ type: 'call:signal', to: peerId, signal: { kind: 'hangup' } });
  },
}));
