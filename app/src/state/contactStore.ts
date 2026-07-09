import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { UserRow, ContactRequestRow } from '../types/database';
import { useAuthStore } from './authStore';

export interface ContactRequestWithUser extends ContactRequestRow {
  otherUser: UserRow;
}

interface ContactState {
  approved: UserRow[];
  incoming: ContactRequestWithUser[];
  outgoing: ContactRequestWithUser[];
  blocked: string[];
  loading: boolean;
  wired: boolean;
  wire: () => void;
  refresh: () => Promise<void>;
  searchByUsername: (query: string) => Promise<UserRow[]>;
  sendRequest: (receiverId: string) => Promise<void>;
  respond: (requestId: string, accept: boolean) => Promise<void>;
  block: (userId: string, reason?: string) => Promise<void>;
  report: (userId: string, reason: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
}

export const useContactStore = create<ContactState>((set, get) => ({
  approved: [],
  incoming: [],
  outgoing: [],
  blocked: [],
  loading: false,
  wired: false,

  wire: () => {
    if (get().wired) return;
    set({ wired: true });
    supabase
      .channel('contact_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests' }, () => {
        get().refresh();
      })
      .subscribe();
  },

  refresh: async () => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    set({ loading: true });

    const [{ data: reqs }, { data: blocks }] = await Promise.all([
      supabase
        .from('contact_requests')
        .select('*, sender:sender_id(*), receiver:receiver_id(*)')
        .or(`sender_id.eq.${me},receiver_id.eq.${me}`),
      supabase.from('blocked_users').select('blocked_id').eq('blocker_id', me),
    ]);

    const blockedIds = (blocks ?? []).map((b) => b.blocked_id);
    const all = (reqs ?? []) as any[];
    const approved: UserRow[] = [];
    const incoming: ContactRequestWithUser[] = [];
    const outgoing: ContactRequestWithUser[] = [];

    for (const r of all) {
      const otherUser = r.sender_id === me ? r.receiver : r.sender;
      if (!otherUser) continue;
      // blocked_users has no relationship to contact_requests in the schema
      // — an approved request stays "approved" forever regardless of a
      // later block, so this list must cross-reference blocks itself or a
      // blocked contact reappears in Chats/Contacts on every refresh.
      if (blockedIds.includes(otherUser.id)) continue;
      if (r.status === 'approved') {
        approved.push(otherUser);
      } else if (r.status === 'pending' && r.receiver_id === me) {
        incoming.push({ ...r, otherUser });
      } else if (r.status === 'pending' && r.sender_id === me) {
        outgoing.push({ ...r, otherUser });
      }
    }

    set({
      approved,
      incoming,
      outgoing,
      blocked: blockedIds,
      loading: false,
    });
  },

  searchByUsername: async (query) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!query.trim()) return [];
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('username', `%${query.trim()}%`)
      .neq('id', me ?? '')
      .limit(20);
    return (data ?? []) as UserRow[];
  },

  sendRequest: async (receiverId) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    await supabase.from('contact_requests').insert({ sender_id: me, receiver_id: receiverId, status: 'pending' });
    await get().refresh();
  },

  respond: async (requestId, accept) => {
    await supabase
      .from('contact_requests')
      .update({ status: accept ? 'approved' : 'declined', responded_at: new Date().toISOString() })
      .eq('id', requestId);
    await get().refresh();
  },

  block: async (userId, reason) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    await supabase.from('blocked_users').insert({ blocker_id: me, blocked_id: userId, reason: reason ?? null });
    // Blocking someone you're an approved contact with previously left them
    // in `approved` — still showing up in Chats/Contacts as if nothing
    // happened, which is exactly what "blocked users behaving unexpectedly"
    // looked like. Block and approved-contact status are independent state
    // (no DB relationship between them), so prune it client-side here too.
    set((s) => ({ blocked: [...s.blocked, userId], approved: s.approved.filter((c) => c.id !== userId) }));
  },

  report: async (userId, reason) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    await supabase.from('blocked_users').insert({ blocker_id: me, blocked_id: userId, is_report: true, reason });
  },

  unblock: async (userId) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    await supabase.from('blocked_users').delete().eq('blocker_id', me).eq('blocked_id', userId);
    set((s) => ({ blocked: s.blocked.filter((id) => id !== userId) }));
  },
}));
