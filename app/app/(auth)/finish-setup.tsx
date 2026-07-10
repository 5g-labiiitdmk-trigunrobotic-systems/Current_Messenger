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
 * just tapped the email confirmation link) and for a returning login that's
 * missing a required step. Routes to whichever step is still incomplete:
 * email → phone → TOTP enrollment → tabs. A cold-start resume can't recover
 * the in-memory signup wizard's username/phone, so it restarts the
 * phone+TOTP mini-flow from add-phone — the same trade-off this screen
 * already accepted pre-TOTP for a lost username.
 */
export default function FinishSetupScreen() {
  const { tokens } = useTheme();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const needsProfileSetup = useAuthStore((s) => s.needsProfileSetup);
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
      // (finalizeAccount only ever runs from totp-setup.tsx, after phone
      // verification). Restart the phone+TOTP mini-flow from scratch.
      set({ email: session.user.email ?? '' });
      router.replace('/(auth)/add-phone');
      return;
    }
    if (needsProfileSetup) {
      // Profile row exists (email + phone already verified) but no
      // verified TOTP factor — either mid-signup-interrupted or an older
      // account created before TOTP existed. Either way, TOTP enrollment
      // is the only thing left.
      set({ username: profile.username, email: profile.email, phone: profile.phone ?? '' });
      router.replace('/(auth)/totp-setup');
      return;
    }
    router.replace('/(tabs)/chats');
  }, [session, profile, needsProfileSetup]);

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
