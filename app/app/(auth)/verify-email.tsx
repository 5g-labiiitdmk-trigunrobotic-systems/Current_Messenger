import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useSignupStore } from '../../src/state/signupStore';
import { supabase } from '../../src/lib/supabase';

export default function VerifyEmailScreen() {
  const { tokens, a1 } = useTheme();
  const email = useSignupStore((s) => s.email);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const onVerify = async () => {
    if (code.trim().length < 4) {
      Alert.alert('Enter the code', 'Check your email for the 6-digit verification code.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' });
    setLoading(false);
    if (error) {
      Alert.alert('Verification failed', error.message);
      return;
    }
    router.push('/(auth)/add-phone');
  };

  const onResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) Alert.alert('Could not resend', error.message);
    else Alert.alert('Code sent', `A new code was sent to ${email}.`);
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${email || 'your email'}.`} />

      <View style={{ marginTop: 28 }}>
        <GlassField
          label="Verification code"
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          style={{ letterSpacing: 6, fontSize: 20 }}
        />
      </View>

      <PrimaryButton title="Verify email" onPress={onVerify} loading={loading} style={{ marginTop: 22 }} />

      <Text onPress={onResend} style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, fontFamily: fontFamilies.bold, color: resending ? tokens.text3 : a1 }}>
        {resending ? 'Sending…' : 'Resend code'}
      </Text>
    </ScreenScaffold>
  );
}
