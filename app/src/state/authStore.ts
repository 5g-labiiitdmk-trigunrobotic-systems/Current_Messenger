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
  /** true once auth.users exists but public.users row (fully-verified profile) doesn't yet */
  needsProfileSetup: boolean;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserRow, 'display_name' | 'bio' | 'status_visibility'>>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  initializing: true,
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
    if (error) return;
    set({ profile: data as UserRow | null, needsProfileSetup: !data || !data.email_verified });
  },

  updateProfile: async (patch) => {
    const session = get().session;
    if (!session) return;
    const { error } = await supabase.from('users').update(patch).eq('id', session.user.id);
    if (!error) set((s) => ({ profile: s.profile ? { ...s.profile, ...patch } : s.profile }));
  },

  signOut: async () => {
    relayClient.disconnect();
    await supabase.auth.signOut();
    set({ session: null, profile: null, needsProfileSetup: false });
  },
}));
