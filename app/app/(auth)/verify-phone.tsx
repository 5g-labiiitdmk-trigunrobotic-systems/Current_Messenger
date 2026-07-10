import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton } from '../../src/components/Buttons';
import { useSignupStore } from '../../src/state/signupStore';
import { confirmPhoneOtp } from '../../src/lib/firebase';
import { appAlert } from '../../src/state/alertStore';

export default function VerifyPhoneScreen() {
  const { phone, phoneConfirmation, set } = useSignupStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    if (!phoneConfirmation) {
      appAlert('Session expired', 'Please re-enter your phone number.');
      router.replace('/(auth)/add-phone');
      return;
    }
    if (code.trim().length < 4) {
      appAlert('Enter the code', 'Check your texts for the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const cred = await confirmPhoneOtp(phoneConfirmation, code.trim());
      // Phone is verified, but the account isn't finalized yet — TOTP
      // enrollment (the next screen) still has to succeed first. Carry the
      // Firebase UID forward instead of calling finalizeAccount() here.
      set({ firebaseUid: cred.user.uid });
      router.replace('/(auth)/totp-setup');
    } catch (e: any) {
      appAlert('Verification failed', e?.message ?? 'Incorrect code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Enter the code" subtitle={`We texted a 6-digit code to ${phone}.`} />
      <View style={{ marginTop: 28 }}>
        <GlassField label="Verification code" placeholder="123456" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} style={{ letterSpacing: 6, fontSize: 20 }} />
      </View>
      <PrimaryButton title="Verify phone" onPress={onVerify} loading={loading} style={{ marginTop: 22 }} />
    </ScreenScaffold>
  );
}
