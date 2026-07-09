import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton, GlassButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useSignupStore } from '../../src/state/signupStore';
import { supabase } from '../../src/lib/supabase';
import { AUTH_REDIRECT_URL } from '../../src/lib/authDeepLink';
import { appAlert } from '../../src/state/alertStore';

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

export default function SignupScreen() {
  const { tokens } = useTheme();
  const set = useSignupStore((s) => s.set);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      appAlert('Invalid username', 'Use 3-24 characters: lowercase letters, numbers, "_" or "."');
      return;
    }
    if (!email.includes('@')) {
      appAlert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      appAlert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      appAlert("Passwords don't match", 'Double check both password fields.');
      return;
    }

    setLoading(true);
    const { data: existing } = await supabase.from('users').select('id').eq('username', uname).maybeSingle();
    if (existing) {
      setLoading(false);
      appAlert('Username taken', 'Try a different username.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    setLoading(false);
    if (error) {
      appAlert('Sign up failed', error.message);
      return;
    }
    set({ username: uname, email, password });
    router.push('/(auth)/verify-email');
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Create account" subtitle="We'll email you a confirmation link — verify it to activate your account." />

      <View style={{ marginTop: 28, gap: 14 }}>
        <GlassField label="Username" placeholder="@yourname" autoCapitalize="none" value={username} onChangeText={setUsername} />
        <GlassField label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <GlassField label="Password" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} />
        <GlassField label="Confirm password" placeholder="Re-enter password" secureTextEntry value={confirm} onChangeText={setConfirm} />
      </View>

      <PrimaryButton title="Continue — verify email" onPress={onSubmit} loading={loading} style={{ marginTop: 24 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: tokens.glassBorder }} />
        <Text style={{ fontSize: 12, color: tokens.text3, fontFamily: fontFamilies.semibold }}>social sign-in disabled</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: tokens.glassBorder }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GlassButton
          title="Google"
          height={52}
          style={{ flex: 1, opacity: 0.5 }}
          onPress={() => appAlert('Verified email required', 'Current requires a verified email for security — social sign-in is intentionally unavailable.')}
        />
        <GlassButton
          title="Apple"
          height={52}
          style={{ flex: 1, opacity: 0.5 }}
          onPress={() => appAlert('Verified email required', 'Current requires a verified email for security — social sign-in is intentionally unavailable.')}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
        <Text style={{ fontSize: 13.5, color: tokens.text2, fontFamily: fontFamilies.regular }}>Already have an account?</Text>
        <Text style={{ fontSize: 13.5, color: '#7c5cff', fontFamily: fontFamilies.bold }} onPress={() => router.push('/(auth)/login')}>
          Log in
        </Text>
      </View>
    </ScreenScaffold>
  );
}
