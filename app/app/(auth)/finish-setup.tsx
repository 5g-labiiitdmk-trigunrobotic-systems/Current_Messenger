import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/state/authStore';
import { useSignupStore } from '../../src/state/signupStore';
import { finalizeAccount } from '../../src/lib/account';

/**
 * Landing spot for a resumed session (e.g. the app was killed mid-signup, or
 * the user just tapped the email confirmation link). Once email is verified,
 * this is also the single place that creates the public.users row — the
 * in-memory signup wizard's username can't survive a restart, so a cold-start
 * resume falls back to deriving one from the email address.
 */
export default function FinishSetupScreen() {
  const { tokens } = useTheme();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const set = useSignupStore((s) => s.set);

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
      const pendingUsername = useSignupStore.getState().username;
      const username = pendingUsername || (session.user.email ?? '').split('@')[0].toLowerCase();
      finalizeAccount({ userId: session.user.id, username, email: session.user.email ?? '' })
        .then(() => useAuthStore.getState().refreshProfile())
        .then(() => useSignupStore.getState().reset())
        .catch(() => {});
      return;
    }
    router.replace('/(tabs)/chats');
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
