import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserRow } from '../types/database';
import { getOrCreateDeviceKeyPair, publishPublicKey } from '../lib/keystore';
import { relayClient } from '../lib/relayClient';
import { registerForPushNotifications } from '../lib/push';

interface AuthState {
  session: Session | null;
  profile: UserRow | null;
  initializing: boolean;
  /** Set when the last refreshProfile() call failed (RLS, network, etc.) —
   * previously this failed completely silently, leaving profile stuck at
   * null forever with no indication anything was wrong. */
  profileError: string | null;
  /** true once auth.users exists but public.users row (fully-verified profile) doesn't yet */
  needsProfileSetup: boolean;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserRow, 'display_name' | 'bio' | 'status_visibility'>>) => Promise<void>;
  /** Resolves to null on success, or a user-facing error message. */
  changeUsername: (username: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

// Same rule enforced at signup and by the DB check constraint — keep in sync.
export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  initializing: true,
  profileError: null,
  needsProfileSetup: false,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) await get().refreshProfile();
    set({ initializing: false });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session) {
        await get().refreshProfile();
        const kp = await getOrCreateDeviceKeyPair();
        await publishPublicKey(session.user.id, kp.publicKey).catch(() => {});
        relayClient.connect(session.access_token);
        if (!get().needsProfileSetup) {
          registerForPushNotifications(session.user.id).catch(() => {});
        }
      } else {
        set({ profile: null, needsProfileSetup: false });
        relayClient.disconnect();
      }
    });
  },

  refreshProfile: async () => {
    const session = get().session;
    if (!session) return;
    const { data, error } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auth] refreshProfile failed:', error.message);
      set({ profileError: error.message });
      return;
    }
    set({ profile: data as UserRow | null, needsProfileSetup: !data || !data.email_verified, profileError: null });
  },

  updateProfile: async (patch) => {
    const session = get().session;
    if (!session) return;
    const { error } = await supabase.from('users').update(patch).eq('id', session.user.id);
    if (!error) set((s) => ({ profile: s.profile ? { ...s.profile, ...patch } : s.profile }));
  },

  changeUsername: async (raw) => {
    const session = get().session;
    if (!session) return 'Not signed in.';
    const username = raw.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      return 'Usernames are 3-24 characters: lowercase letters, numbers, "_" or "."';
    }
    if (username === get().profile?.username) return null; // no-op
    // Pre-check for a friendly error; the DB unique constraint is the real
    // guarantee, so a race between check and update still surfaces below.
    const { data: taken } = await supabase.from('users').select('id').eq('username', username).neq('id', session.user.id).maybeSingle();
    if (taken) return 'That username is taken — try another.';
    const { error } = await supabase.from('users').update({ username }).eq('id', session.user.id);
    if (error) {
      return error.code === '23505' ? 'That username is taken — try another.' : error.message;
    }
    set((s) => ({ profile: s.profile ? { ...s.profile, username } : s.profile }));
    return null;
  },

  signOut: async () => {
    relayClient.disconnect();
    await supabase.auth.signOut();
    set({ session: null, profile: null, needsProfileSetup: false });
  },
}));
