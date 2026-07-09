import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/state/authStore';
import { useSignupStore } from '../../src/state/signupStore';
import { finalizeAccount } from '../../src/lib/account';
import { generateFriendlyUsername } from '../../src/lib/usernameGen';

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
        const pendingUsername = useSignupStore.getState().username;
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
          Alert.alert('Could not finish setup', 'Please try signing in again.');
          router.replace('/(auth)/onboarding');
          return;
        }
        await useAuthStore.getState().refreshProfile();
        useSignupStore.getState().reset();
      })();
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
