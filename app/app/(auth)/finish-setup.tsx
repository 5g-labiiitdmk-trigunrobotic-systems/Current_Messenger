import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/state/authStore';
import { useSignupStore } from '../../src/state/signupStore';

/**
 * Landing spot for a resumed session (app killed mid-signup, or the user
 * just tapped the email confirmation link). Routes to whichever step is
 * still incomplete: email → phone → tabs. A cold-start resume can't
 * recover the in-memory signup wizard's username, so a lost-username
 * resume just restarts the phone verification step from scratch.
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
      // No public.users row yet — phone verification hasn't happened
      // (finalizeAccount only ever runs from verify-phone.tsx, once phone
      // verification succeeds). Restart the phone-verification step.
      set({ email: session.user.email ?? '' });
      router.replace('/(auth)/add-phone');
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
