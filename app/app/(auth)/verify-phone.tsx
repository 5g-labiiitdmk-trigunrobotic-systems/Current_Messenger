import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton } from '../../src/components/Buttons';
import { useSignupStore } from '../../src/state/signupStore';
import { confirmPhoneOtp } from '../../src/lib/firebase';
import { finalizeAccount } from '../../src/lib/account';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/state/authStore';
import { registerForPushNotifications } from '../../src/lib/push';
import { appAlert } from '../../src/state/alertStore';

export default function VerifyPhoneScreen() {
  const { phone, phoneConfirmation, username, email, reset } = useSignupStore();
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session — please log in again.');

      await finalizeAccount({
        userId: session.user.id,
        username,
        email,
        phone,
        firebaseUid: cred.user.uid,
      });
      await useAuthStore.getState().refreshProfile();
      registerForPushNotifications(session.user.id).catch(() => {});
      reset();
      router.replace('/(tabs)/chats');
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
      <PrimaryButton title="Verify & create account" onPress={onVerify} loading={loading} style={{ marginTop: 22 }} />
    </ScreenScaffold>
  );
}
