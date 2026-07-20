import { create } from 'zustand';
import { relayClient } from '../lib/relayClient';
import type { ServerEvent } from '../types/relay';
import { useAuthStore } from './authStore';
import { useContactStore } from './contactStore';
import { appAlert } from './alertStore';

export interface GroupInfo {
  id: string;
  name: string;
  memberIds: string[];
  ownerId: string;
  isBroadcast: boolean;
  createdAt: string;
}

export interface IncomingGroupInvite {
  groupId: string;
  groupName: string;
  from: string; // inviter's userId
  isBroadcast: boolean;
}

/**
 * Group identity/membership is intentionally NOT in Supabase (only users,
 * contact_requests, blocked_users, device_keys are persisted there). Groups
 * live only in the relay server's process memory, and this store mirrors
 * that in the client's memory for the current app session — a relay restart
 * or app restart both drop group membership, matching the zero-persistence
 * rule literally. Re-inviting members after a restart is a one-tap action.
 *
 * Membership additions require the invitee's consent — the same
 * request/accept idiom app/src/state/chatSessionStore.ts already uses for
 * 1:1 chat sessions, reused here rather than inventing a separate model.
 * invite()/createGroup() only ever send a REQUEST; a group only appears in
 * `groups` for someone once they've actually accepted (see the
 * 'group:invited' handler below — the relay never sends it until then).
 */
interface GroupState {
  groups: Record<string, GroupInfo>;
  // groupId -> the pending invite waiting on MY response, if any.
  incomingInvites: Record<string, IncomingGroupInvite>;
  wired: boolean;
  wire: () => void;
  createGroup: (name: string, memberIds: string[], isBroadcast?: boolean) => string;
  invite: (groupId: string, userId: string) => void;
  respondToInvite: (groupId: string, accept: boolean) => void;
  leave: (groupId: string) => void;
}

// Tracks which groupId the currently-shown incoming-invite alert (if any)
// is for — same pattern chatSessionStore.ts uses for session:request, so a
// stale/duplicate prompt can't linger after this invite is already
// resolved some other way.
let incomingAlertForGroupId: string | null = null;

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: {},
  incomingInvites: {},
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
      if (event.type === 'group:invite_request') {
        set((s) => ({
          incomingInvites: {
            ...s.incomingInvites,
            [event.groupId]: { groupId: event.groupId, groupName: event.groupName, from: event.from, isBroadcast: !!event.isBroadcast },
          },
        }));
        const contact = useContactStore.getState().approved.find((c) => c.id === event.from);
        const name = contact?.display_name || contact?.username || 'Someone';
        incomingAlertForGroupId = event.groupId;
        appAlert(`${name} added you to "${event.groupName}"`, 'Accept to join this group and start receiving its messages.', [
          { text: 'Decline', style: 'destructive', onPress: () => get().respondToInvite(event.groupId, false) },
          { text: 'Accept', onPress: () => get().respondToInvite(event.groupId, true) },
        ]);
      }
      if (event.type === 'group:invited') {
        // Only ever arrives after an invite is actually accepted — either
        // this device's own (the new member, learning the group for the
        // first time) or another member's (an existing member, whose
        // roster just needs the updated memberIds).
        set((s) => ({
          groups: {
            ...s.groups,
            [event.groupId]: {
              id: event.groupId,
              name: event.name,
              memberIds: event.memberIds,
              ownerId: event.ownerId,
              isBroadcast: !!event.isBroadcast,
              createdAt: s.groups[event.groupId]?.createdAt ?? new Date().toISOString(),
            },
          },
          incomingInvites: (() => {
            if (!s.incomingInvites[event.groupId]) return s.incomingInvites;
            const next = { ...s.incomingInvites };
            delete next[event.groupId];
            return next;
          })(),
        }));
      }
      if (event.type === 'group:invite_declined') {
        if (incomingAlertForGroupId === event.groupId) incomingAlertForGroupId = null;
        const reasonLabel =
          event.reason === 'declined'
            ? 'declined the invite.'
            : event.reason === 'timeout'
              ? "didn't respond in time."
              : event.reason === 'not_contact'
                ? "isn't an approved contact, so they can't be invited yet."
                : "wasn't reachable right now.";
        appAlert('Invite not accepted', `They ${reasonLabel}`);
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
    // `memberIds` here is who to INVITE — the relay only adds the creator
    // immediately and sends the rest a pending group:invite_request (see
    // the matching comment on this event in src/types/relay.ts).
    relayClient.send({ type: 'group:create', groupId, name, memberIds, isBroadcast });
    return groupId;
  },

  invite: (groupId, userId) => relayClient.send({ type: 'group:invite', groupId, to: userId }),

  respondToInvite: (groupId, accept) => {
    set((s) => {
      if (!s.incomingInvites[groupId]) return s;
      const next = { ...s.incomingInvites };
      delete next[groupId];
      return { incomingInvites: next };
    });
    if (incomingAlertForGroupId === groupId) incomingAlertForGroupId = null;
    relayClient.send({ type: 'group:invite_respond', groupId, accept });
  },

  leave: (groupId) => relayClient.send({ type: 'group:leave', groupId }),
}));
