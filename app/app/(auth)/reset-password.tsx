import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/state/authStore';
import { appAlert } from '../../src/state/alertStore';

// How long to wait for the recovery session before telling the user the link failed.
const RESET_LINK_TIMEOUT_MS = 12000;

/**
 * Reached via the current://reset-password deep link (see
 * src/lib/authDeepLink.ts + app/_layout.tsx). Expo Router's own automatic
 * deep-link navigation can land here before the global handler in
 * _layout.tsx finishes awaiting setSession(...) with the recovery tokens
 * from the email link, so — same reasoning as verify-email.tsx — this
 * gates the actual form behind `session` from authStore rather than
 * assuming one already exists on mount.
 */
export default function ResetPasswordScreen() {
  const { tokens } = useTheme();
  const session = useAuthStore((s) => s.session);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  // If the recovery session never shows up (expired / already-used / broken
  // link) the screen used to spin on "Verifying reset link…" forever.
  const [linkTimedOut, setLinkTimedOut] = useState(false);
  useEffect(() => {
    if (session) {
      setLinkTimedOut(false);
      return;
    }
    const t = setTimeout(() => setLinkTimedOut(true), RESET_LINK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [session]);

  const canSubmit = !loading && password.length >= 8 && password === confirm;

  // onSubmit(): validates the two password fields, then applies the new
  // password to the recovery session already established by the time
  // this form is reachable, and routes onward exactly like a normal
  // login (finish-setup if the profile is incomplete, otherwise the app).
  const onSubmit = async () => {
    if (password.length < 8) {
      appAlert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      appAlert("Passwords don't match", 'Double check both password fields.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      appAlert('Could not reset password', error.message);
      return;
    }
    await useAuthStore.getState().refreshProfile();
    setLoading(false);
    appAlert('Password updated', 'Your password has been reset.');
    const needsSetup = useAuthStore.getState().needsProfileSetup;
    router.replace(needsSetup ? '/(auth)/finish-setup' : '/(tabs)/chats');
  };

  if (!session && linkTimedOut) {
    return (
      <ScreenScaffold scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: fontFamilies.heavy, color: tokens.text, fontSize: 18, textAlign: 'center' }}>This reset link did not work</Text>
          <Text style={{ fontFamily: fontFamilies.medium, color: tokens.text2, fontSize: 13.5, textAlign: 'center', lineHeight: 19 }}>
            It may have expired or already been used. Request a new link from the login screen.
          </Text>
          <PrimaryButton title="Back to login" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </ScreenScaffold>
    );
  }

  if (!session) {
    return (
      <ScreenScaffold scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <ActivityIndicator color={tokens.text} />
          <Text style={{ fontFamily: fontFamilies.medium, color: tokens.text2, fontSize: 13 }}>Verifying reset link…</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <AuthHeader title="Set a new password" subtitle="Choose a new password for your account." />

      <View style={{ marginTop: 30, gap: 14 }}>
        <GlassField label="New password" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} />
        <GlassField label="Confirm new password" placeholder="Re-enter password" secureTextEntry value={confirm} onChangeText={setConfirm} />
      </View>

      <PrimaryButton title="Reset password" onPress={onSubmit} loading={loading} disabled={!canSubmit} style={{ marginTop: 26 }} />
    </ScreenScaffold>
  );
}
