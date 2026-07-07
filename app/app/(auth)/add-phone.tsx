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
import { sendPhoneOtp } from '../../src/lib/firebase';

const E164_RE = /^\+[1-9]\d{7,14}$/;

export default function AddPhoneScreen() {
  const { tokens } = useTheme();
  const set = useSignupStore((s) => s.set);
  const [phone, setPhone] = useState('+');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!E164_RE.test(phone.trim())) {
      Alert.alert('Invalid phone number', 'Enter your number in international format, e.g. +14155550123.');
      return;
    }
    setLoading(true);
    try {
      const confirmation = await sendPhoneOtp(phone.trim());
      set({ phone: phone.trim(), phoneConfirmation: confirmation });
      router.push('/(auth)/verify-phone');
    } catch (e: any) {
      Alert.alert('Could not send code', e?.message ?? 'Check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Verify your phone" subtitle="Email confirmed. Now add your mobile number — both are required for every account." />

      <View style={{ marginTop: 28 }}>
        <GlassField label="Phone number" placeholder="+14155550123" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Text style={{ marginTop: 10, fontSize: 12, fontFamily: fontFamilies.regular, color: tokens.text3, paddingHorizontal: 4 }}>
          Include your country code (e.g. +1 for the US). We'll text you a 6-digit code.
        </Text>
      </View>

      <PrimaryButton title="Send code" onPress={onSubmit} loading={loading} style={{ marginTop: 22 }} />
    </ScreenScaffold>
  );
}
