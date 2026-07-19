import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/state/authStore';
import { useSignupStore } from '../../src/state/signupStore';
import { finalizeAccount } from '../../src/lib/account';
import { generateFriendlyUsername } from '../../src/lib/usernameGen';
import { appAlert } from '../../src/state/alertStore';

/**
 * Landing spot for a resumed session (e.g. the app was killed mid-signup, or
 * the user just tapped the email confirmation link). Once email is verified,
 * this is also the single place that creates the public.users row — the
 * in-memory signup wizard's username can't survive a restart, so a cold-start
 * resume falls back to a randomly generated one (never derived from the
 * email address — that would leak it into a public field).
 */
export default function FinishSetupScreen() {
  const { tokens } = useTheme();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const set = useSignupStore((s) => s.set);
  const finalizing = useRef(false);

  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/onboarding');
      return;
    }
    const emailConfirmed = !!session.user.email_confirmed_at;
    if (!emailConfirmed) {
      set({ email: session.user.email ?? '' });
      router.replace('/(auth)/verify-email');
      return;
    }
    if (!profile) {
      if (finalizing.current) return;
      finalizing.current = true;
      (async () => {
        // Prefer, in order: the in-memory signup wizard's choice (fastest,
        // no round trip, but wiped if the app was closed while checking
        // email), then the same username stashed durably in Supabase's own
        // auth.users.user_metadata at signUp() time (see signup.tsx's
        // options.data) — this is what actually survives that restart —
        // and only fall back to a random one if genuinely neither exists
        // (e.g. an account from before this fix, or signup was somehow
        // skipped entirely).
        const pendingUsername = useSignupStore.getState().username || (session.user.user_metadata?.username as string | undefined);
        let username = pendingUsername || generateFriendlyUsername();
        let succeeded = false;
        for (let attempt = 0; attempt < 3 && !succeeded; attempt++) {
          try {
            await finalizeAccount({ userId: session.user.id, username, email: session.user.email ?? '' });
            succeeded = true;
          } catch {
            username = generateFriendlyUsername(); // likely a username collision — try a fresh one
          }
        }
        finalizing.current = false;
        if (!succeeded) {
          appAlert('Could not finish setup', 'Please try signing in again.');
          router.replace('/(auth)/onboarding');
          return;
        }
        await useAuthStore.getState().refreshProfile();
        useSignupStore.getState().reset();
      })();
      return;
    }
    // Brand-new account, about to land in the chat list — this is exactly
    // where a race with E2E key publishing has real consequences: if the
    // user (or someone messaging them) sends a message before their
    // publishPublicKey() write (kicked off in the background by
    // authStore's auth-state-change listener, not something this
    // navigation previously waited on) finishes, the message arrives
    // undecryptable and stays that way — decryption only ever happens
    // once, at receive time. Awaiting it here closes that window for the
    // account actually being created; see fetchPublicKeyWithRetry in
    // chatStore.ts for the complementary fix on the receiving side, for
    // races this can't cover (e.g. network latency on the OTHER party's
    // device). ensureDeviceKeyPublished() no-ops fast if already done —
    // it usually finishes well before the app even gets here.
    (async () => {
      await useAuthStore.getState().ensureDeviceKeyPublished();
      router.replace('/(tabs)/chats');
    })();
  }, [session, profile]);

  return (
    <ScreenScaffold scroll={false}>
      <AuthHeader title="One moment" subtitle="Picking up where you left off…" showBack={false} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <ActivityIndicator color={tokens.text} />
        <Text style={{ fontFamily: fontFamilies.medium, color: tokens.text2, fontSize: 13 }}>Checking your verification status…</Text>
      </View>
    </ScreenScaffold>
  );
}
