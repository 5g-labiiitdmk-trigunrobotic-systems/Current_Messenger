import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton, GlassButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/state/authStore';
import { appAlert } from '../../src/state/alertStore';

export default function LoginScreen() {
  const { tokens, a1, a2 } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!identifier.trim() || !password) {
      appAlert('Missing info', 'Enter your email/username and password.');
      return;
    }
    setLoading(true);
    let email = identifier.trim();
    if (!email.includes('@')) {
      const { data } = await supabase.from('users').select('email').eq('username', email.toLowerCase()).maybeSingle();
      if (!data) {
        setLoading(false);
        appAlert('Account not found', 'No account with that username.');
        return;
      }
      email = data.email;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      appAlert('Login failed', error.message);
      return;
    }
    await useAuthStore.getState().refreshProfile();
    setLoading(false);
    const needsSetup = useAuthStore.getState().needsProfileSetup;
    router.replace(needsSetup ? '/(auth)/finish-setup' : '/(tabs)/chats');
  };

  const onForgot = async () => {
    if (!identifier.includes('@')) {
      appAlert('Enter your email', 'Type your email address above first, then tap "Forgot password?" again.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim());
    appAlert(error ? 'Could not send reset email' : 'Check your inbox', error ? error.message : `Password reset instructions sent to ${identifier}.`);
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Welcome back" subtitle="Unlock your private space." />

      <View style={{ marginTop: 30, gap: 14 }}>
        <GlassField label="Email or username" placeholder="@yourname" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} />
        <GlassField label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
        <Pressable onPress={() => setRemember((r) => !r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: tokens.glassBorder,
              backgroundColor: remember ? a1 : tokens.field,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {remember && (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 6L9 17l-5-5" />
              </Svg>
            )}
          </View>
          <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Remember me</Text>
        </Pressable>
        <Text onPress={onForgot} style={{ fontSize: 13.5, fontFamily: fontFamilies.bold, color: a1 }}>
          Forgot password?
        </Text>
      </View>

      <PrimaryButton title="Log in" onPress={onSubmit} loading={loading} style={{ marginTop: 26 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: tokens.glassBorder }} />
        <Text style={{ fontSize: 12, color: tokens.text3, fontFamily: fontFamilies.semibold }}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: tokens.glassBorder }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <GlassButton title="Google" height={52} style={{ flex: 1, opacity: 0.5 }} onPress={() => appAlert('Not available', 'Current requires verified email sign-in.')} />
        <GlassButton title="Apple" height={52} style={{ flex: 1, opacity: 0.5 }} onPress={() => appAlert('Not available', 'Current requires verified email sign-in.')} />
      </View>
    </ScreenScaffold>
  );
}
