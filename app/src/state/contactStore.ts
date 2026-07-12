import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { UserRow, ContactRequestRow } from '../types/database';
import { useAuthStore } from './authStore';
import { relayClient } from '../lib/relayClient';

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

// refresh() is triggered a lot — on mount, after sendRequest/respond/block,
// and by the realtime subscription below, which (see wire()) fires on
// EVERY user's contact_requests activity app-wide, not just this user's own.
// With no ordering guard, two overlapping calls could resolve out of order:
// if an earlier-started call happens to resolve LAST, its now-stale
// snapshot overwrites a newer, more-complete one — an approved contact
// that's genuinely still approved would appear to vanish from
// Chats/Contacts until the next refresh happened to fire. This was the
// most likely real cause of "chats randomly disappear" — sequence-guarding
// so only the most-recently-issued call's response can ever apply.
let refreshSeq = 0;

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
    const mySeq = ++refreshSeq;
    set({ loading: true });

    const [{ data: reqs }, { data: blocks }] = await Promise.all([
      supabase
        .from('contact_requests')
        .select('*, sender:sender_id(*), receiver:receiver_id(*)')
        .or(`sender_id.eq.${me},receiver_id.eq.${me}`),
      supabase.from('blocked_users').select('blocked_id').eq('blocker_id', me),
    ]);

    if (mySeq !== refreshSeq) return; // a newer refresh() call has since started — this response is stale, drop it

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
    const { error } = await supabase.from('contact_requests').insert({ sender_id: me, receiver_id: receiverId, status: 'pending' });
    // Push-notification trigger only — this insert is already the real,
    // durable request (Supabase is the source of truth); the relay never
    // sees this insert happen on its own, so without this a request sent
    // while the recipient is offline/backgrounded gets zero notification
    // until they happen to open the app. Best-effort: skip entirely if the
    // insert itself failed, and never block on the relay round-trip.
    if (!error) relayClient.send({ type: 'contact:request_sent', to: receiverId });
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
    // A row in blocked_users counts as a block regardless of is_report (see
    // refresh()'s filter), so this genuinely does also block them — the UI
    // already says so. Match block()'s optimistic update so that's reflected
    // immediately instead of waiting for the next refresh().
    set((s) => ({ blocked: [...s.blocked, userId], approved: s.approved.filter((c) => c.id !== userId) }));
  },

  unblock: async (userId) => {
    const me = useAuthStore.getState().session?.user.id;
    if (!me) return;
    await supabase.from('blocked_users').delete().eq('blocker_id', me).eq('blocked_id', userId);
    set((s) => ({ blocked: s.blocked.filter((id) => id !== userId) }));
  },
}));
