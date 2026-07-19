import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import type { UserRow } from '../types/database';
import { getOrCreateDeviceKeyPair, publishPublicKey } from '../lib/keystore';
import { relayClient } from '../lib/relayClient';
import { registerForPushNotifications } from '../lib/push';
import { normalizeUsername, usernameFormatError, isUsernameTaken } from '../lib/username';

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
  /** Generates (if needed) and publishes this device's E2E public key for
   * the current session. Called from the auth-state-change listener below,
   * but also awaited directly from the fresh-signup flow (finish-setup.tsx)
   * — see that call site for why: navigating into the app is not itself
   * gated on this finishing, so without an explicit await there, a
   * brand-new account can reach the chat list and receive/send its first
   * message before its own key has finished publishing. No-ops if there's
   * no active session. Safe to call multiple times — publishPublicKey()
   * itself already no-ops once the exact key is on record. */
  ensureDeviceKeyPublished: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserRow, 'display_name' | 'bio' | 'status_visibility'>>) => Promise<void>;
  /** Resolves to null on success, or a user-facing error message. */
  changeUsername: (username: string) => Promise<string | null>;
  /** Uploads to Supabase Storage (never the users table directly) and saves
   * the resulting public URL on the profile. Resolves to null on success,
   * or a user-facing error message. */
  uploadAvatar: (base64: string, mime: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

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
        await get().ensureDeviceKeyPublished();
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

  ensureDeviceKeyPublished: async () => {
    const session = get().session;
    if (!session) return;
    const kp = await getOrCreateDeviceKeyPair(session.user.id);
    await publishPublicKey(session.user.id, kp.publicKey).catch(() => {});
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
    const username = normalizeUsername(raw);
    const formatError = usernameFormatError(username);
    if (formatError) return formatError;
    if (username === get().profile?.username) return null; // no-op
    // Pre-check for a friendly error; the DB unique constraint is the real
    // guarantee, so a race between check and update still surfaces below.
    if (await isUsernameTaken(username, session.user.id)) return 'That username is taken — try another.';
    const { error } = await supabase.from('users').update({ username }).eq('id', session.user.id);
    if (error) {
      return error.code === '23505' ? 'That username is taken — try another.' : error.message;
    }
    set((s) => ({ profile: s.profile ? { ...s.profile, username } : s.profile }));
    return null;
  },

  uploadAvatar: async (base64, mime) => {
    const session = get().session;
    if (!session) return 'Not signed in.';
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    // Path's first segment must match auth.uid() — enforced by the
    // avatars_owner_* storage policies (migration 0005_avatar_url.sql).
    // A fresh filename per upload (not a fixed "avatar.jpg") sidesteps
    // stale-CDN-cache issues where a same-named replacement wouldn't
    // visibly update for other users for a while.
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, decode(base64), {
      contentType: mime,
      upsert: false,
    });
    if (uploadError) return uploadError.message;

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;

    const previousUrl = get().profile?.avatar_url ?? null;
    const { error: updateError } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', session.user.id);
    if (updateError) return updateError.message;
    set((s) => ({ profile: s.profile ? { ...s.profile, avatar_url: avatarUrl } : s.profile }));

    // Best-effort cleanup of the previous photo — not required for
    // correctness (the profile row already points at the new one) and must
    // never fail the upload the user is actually waiting on.
    if (previousUrl) {
      const prevPath = previousUrl.split('/avatars/')[1];
      if (prevPath) supabase.storage.from('avatars').remove([prevPath]).catch(() => {});
    }
    return null;
  },

  signOut: async () => {
    relayClient.disconnect();
    await supabase.auth.signOut();
    set({ session: null, profile: null, needsProfileSetup: false });
  },
}));
