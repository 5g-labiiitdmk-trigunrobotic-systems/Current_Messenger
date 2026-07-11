import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import { appAlert } from './alertStore';
import { useAlertStore } from './alertStore';
import { useContactStore } from './contactStore';
import type { ServerEvent } from '../types/relay';

/**
 * Per-session chat requests, layered on top of (not instead of) the
 * long-term contact-approval flow in contactStore.ts. A "session" here
 * means: both people have been continuously connected to the relay since
 * it was last accepted — see the matching doc comment in
 * server/src/state.ts for the full reasoning. Reconnecting (this device OR
 * the peer's) always requires a fresh accept, even between two
 * already-approved contacts. This store only mirrors what the relay has
 * already decided — it never itself grants access; message:send is
 * independently enforced server-side regardless of what this shows.
 */
export type SessionState = 'none' | 'pending' | 'accepted' | 'rejected';
export type RejectReason = 'declined' | 'timeout' | 'peer_disconnected' | 'recipient_offline' | 'not_contact';

interface ChatSessionState {
  sessions: Record<string, SessionState>; // peerId -> my outgoing request's state
  rejectReasons: Record<string, RejectReason | undefined>;
  // peerId -> true while they have an unanswered request waiting on ME.
  // Tracked separately from `sessions` (which is about MY OWN outgoing
  // requests) so the chat screen can tell "I'm waiting on them" apart from
  // "they're waiting on me" — conflating the two would mean simply opening
  // a chat screen for someone who already asked to chat would fire our own
  // outgoing request back at them, which the relay's glare-resolution
  // (see handleSessionRequest) would then silently auto-accept — an
  // implicit accept via navigation, not the explicit accept this feature
  // is supposed to require.
  incomingFrom: Record<string, boolean>;
  wired: boolean;
  wire: () => void;
  requestSession: (peerId: string) => void;
  respondToRequest: (peerId: string, accept: boolean) => void;
}

// Tracks which peerId the currently-shown incoming-request alert (if any)
// is for, so a session:request_withdrawn for that specific peer can
// dismiss it without blindly closing an unrelated alert that happens to be
// showing at the same moment.
let incomingAlertForPeerId: string | null = null;

export const useChatSessionStore = create<ChatSessionState>((set, get) => ({
  sessions: {},
  rejectReasons: {},
  incomingFrom: {},
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });

    relayClient.on((event: ServerEvent) => {
      switch (event.type) {
        case 'auth:ok': {
          // Every successful auth (including a reconnect) — reset all
          // local session state rather than trying to guess whether the
          // relay preserved it. Pessimistic, but cheap to be wrong about:
          // if the relay actually did preserve the session (a fast
          // reconnect that never triggered the relay's own disconnect
          // cleanup), a redundant request just gets silently auto-accepted
          // server-side with no visible effect on the other person — see
          // handleSessionRequest's hasActiveSession short-circuit.
          set({ sessions: {}, rejectReasons: {}, incomingFrom: {} });
          break;
        }
        case 'session:request': {
          const peerId = event.from;
          set((s) => ({ incomingFrom: { ...s.incomingFrom, [peerId]: true } }));
          const contact = useContactStore.getState().approved.find((c) => c.id === peerId);
          const name = contact?.display_name || contact?.username || 'Someone';
          incomingAlertForPeerId = peerId;
          appAlert(`${name} wants to chat`, 'Accept to start receiving messages from them again for this session.', [
            { text: 'Decline', style: 'destructive', onPress: () => get().respondToRequest(peerId, false) },
            { text: 'Accept', onPress: () => get().respondToRequest(peerId, true) },
          ]);
          break;
        }
        case 'session:requested': {
          set((s) => ({ sessions: { ...s.sessions, [event.to]: 'pending' } }));
          break;
        }
        case 'session:request_failed': {
          set((s) => ({
            sessions: { ...s.sessions, [event.to]: 'rejected' },
            rejectReasons: { ...s.rejectReasons, [event.to]: event.reason },
          }));
          break;
        }
        case 'session:accepted': {
          set((s) => ({ sessions: { ...s.sessions, [event.from]: 'accepted' }, rejectReasons: { ...s.rejectReasons, [event.from]: undefined } }));
          break;
        }
        case 'session:rejected': {
          set((s) => ({
            sessions: { ...s.sessions, [event.from]: 'rejected' },
            rejectReasons: { ...s.rejectReasons, [event.from]: event.reason },
          }));
          break;
        }
        case 'session:request_withdrawn': {
          set((s) => ({ incomingFrom: { ...s.incomingFrom, [event.from]: false } }));
          if (incomingAlertForPeerId === event.from) {
            incomingAlertForPeerId = null;
            useAlertStore.getState().dismiss();
          }
          break;
        }
        default:
          break;
      }
    });
  },

  requestSession: (peerId) => {
    set((s) => ({ sessions: { ...s.sessions, [peerId]: 'pending' } }));
    relayClient.send({ type: 'session:request', to: peerId });
  },

  respondToRequest: (peerId, accept) => {
    set((s) => ({ incomingFrom: { ...s.incomingFrom, [peerId]: false } }));
    if (incomingAlertForPeerId === peerId) incomingAlertForPeerId = null;
    relayClient.send({ type: 'session:respond', peerId, accept });
    // Optimistic: don't wait on a round-trip to unlock the chat screen for
    // an accept I just chose myself — the relay is the actual source of
    // truth for message:send regardless of what this shows.
    if (accept) set((s) => ({ sessions: { ...s.sessions, [peerId]: 'accepted' } }));
  },
}));

export function getSessionState(peerId: string): SessionState {
  return useChatSessionStore.getState().sessions[peerId] ?? 'none';
}
