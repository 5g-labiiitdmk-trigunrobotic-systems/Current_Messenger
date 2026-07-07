import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import type { ServerEvent } from '../types/relay';
import { useAuthStore } from './authStore';

export interface GroupInfo {
  id: string;
  name: string;
  memberIds: string[];
  ownerId: string;
  isBroadcast: boolean;
  createdAt: string;
}

/**
 * Group identity/membership is intentionally NOT in Supabase (only users,
 * contact_requests, blocked_users, device_keys are persisted there). Groups
 * live only in the relay server's process memory, and this store mirrors
 * that in the client's memory for the current app session — a relay restart
 * or app restart both drop group membership, matching the zero-persistence
 * rule literally. Re-inviting members after a restart is a one-tap action.
 */
interface GroupState {
  groups: Record<string, GroupInfo>;
  wired: boolean;
  wire: () => void;
  createGroup: (name: string, memberIds: string[], isBroadcast?: boolean) => string;
  invite: (groupId: string, userId: string) => void;
  leave: (groupId: string) => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: {},
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });
    relayClient.on((event: ServerEvent) => {
      if (event.type === 'group:created') {
        set((s) => ({
          groups: {
            ...s.groups,
            [event.groupId]: {
              id: event.groupId,
              name: event.name,
              memberIds: event.memberIds,
              ownerId: useAuthStore.getState().session?.user.id ?? '',
              isBroadcast: !!event.isBroadcast,
              createdAt: new Date().toISOString(),
            },
          },
        }));
      }
      if (event.type === 'group:invited') {
        set((s) => ({
          groups: {
            ...s.groups,
            [event.groupId]: {
              id: event.groupId,
              name: event.name,
              memberIds: event.memberIds,
              ownerId: event.from,
              isBroadcast: !!event.isBroadcast,
              createdAt: new Date().toISOString(),
            },
          },
        }));
      }
      if (event.type === 'group:member_left') {
        set((s) => {
          const g = s.groups[event.groupId];
          if (!g) return s;
          return { groups: { ...s.groups, [event.groupId]: { ...g, memberIds: g.memberIds.filter((id) => id !== event.userId) } } };
        });
      }
    });
  },

  createGroup: (name, memberIds, isBroadcast) => {
    const groupId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    relayClient.send({ type: 'group:create', groupId, name, memberIds, isBroadcast });
    return groupId;
  },

  invite: (groupId, userId) => relayClient.send({ type: 'group:invite', groupId, to: userId }),
  leave: (groupId) => relayClient.send({ type: 'group:leave', groupId }),
}));
