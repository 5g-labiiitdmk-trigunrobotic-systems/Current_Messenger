import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import type { ServerEvent } from '../types/relay';

interface PresenceEntry {
  status: 'online' | 'offline';
  lastSeenAt?: string;
}

interface PresenceState {
  byUser: Record<string, PresenceEntry>;
  wired: boolean;
  wire: () => void;
  setMyStatus: (status: 'online' | 'away') => void;
}

/**
 * FILE PURPOSE: Live online/offline presence for every user this relay
 * connection has seen — see presencePolicy.ts for the client-side
 * visibility filtering this store's raw data must be run through.
 *
 * NOTE on the privacy toggle (users.status_visibility): the relay broadcasts
 * presence to every connected socket (it holds no per-user visibility rules
 * in memory, by design, to avoid extra persisted state). Screens that render
 * presence must consult the target user's `status_visibility` profile field
 * (contactStore) and hide the dot/last-seen client-side when it says
 * 'contacts'-but-not-a-contact, or 'nobody'. See ChatsList/Profile screens.
 */
export const usePresenceStore = create<PresenceState>((set, get) => ({
  byUser: {},
  wired: false,

  // Subscribes to presence/presence:snapshot relay events. Call once at
  // app startup.
  wire: () => {
    if (get().wired) return;
    set({ wired: true });
    relayClient.on((event: ServerEvent) => {
      if (event.type === 'presence') {
        set((s) => ({ byUser: { ...s.byUser, [event.userId]: { status: event.status, lastSeenAt: event.lastSeenAt } } }));
      }
      if (event.type === 'auth:ok') {
        // fresh connection — presence map resets, repopulated by the
        // presence:snapshot the server sends right after this.
        set({ byUser: {} });
      }
      if (event.type === 'presence:snapshot') {
        const now = new Date().toISOString();
        set((s) => {
          const byUser = { ...s.byUser };
          for (const id of event.onlineUserIds) byUser[id] = { status: 'online', lastSeenAt: now };
          return { byUser };
        });
      }
    });
  },

  // Broadcasts this device's own presence to the relay (e.g. 'away' when
  // the app backgrounds).
  setMyStatus: (status) => relayClient.send({ type: 'presence:set', status }),
}));
