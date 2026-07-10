import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton } from '../../src/components/Buttons';
import { Glass } from '../../src/components/Glass';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useSignupStore } from '../../src/state/signupStore';
import { useAuthStore } from '../../src/state/authStore';
import { supabase } from '../../src/lib/supabase';
import { enrollTotp, confirmTotpEnrollment, type EnrollResult } from '../../src/lib/totp';
import { generateBackupCodes } from '../../src/lib/backupCodes';
import { finalizeAccount } from '../../src/lib/account';
import { registerForPushNotifications } from '../../src/lib/push';
import { appAlert } from '../../src/state/alertStore';

/**
 * Signup-flow TOTP enrollment. Uses Supabase Auth's native MFA API — the
 * secret is generated and held server-side by Supabase, never by this app.
 * Account finalization (the public.users row) is deferred until this screen
 * completes, since email + phone + TOTP are all mandatory for a real account.
 */
export default function TotpSetupScreen() {
  const { tokens } = useTheme();
  const { username, email, phone, firebaseUid, reset } = useSignupStore();
  const [enrolling, setEnrolling] = useState(true);
  const [enrollment, setEnrollment] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await enrollTotp();
        setEnrollment(result);
      } catch (e: any) {
        appAlert('Could not start 2FA setup', e?.message ?? 'Please try again.');
      } finally {
        setEnrolling(false);
      }
    })();
  }, []);

  const onVerify = async () => {
    if (!enrollment) return;
    if (code.trim().length !== 6) {
      appAlert('Enter the code', 'Type the 6-digit code from your authenticator app.');
      return;
    }
    setVerifying(true);
    try {
      await confirmTotpEnrollment(enrollment.factorId, code.trim());
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session — please log in again.');
      const codes = await generateBackupCodes(session.user.id);
      // Retrofit path (an older account created before TOTP existed, being
      // routed back through this screen by finish-setup.tsx) already has a
      // finalized public.users row — skip re-finalizing since signupStore
      // is empty on a resumed session and would overwrite real data with
      // blanks. Fresh signups always reach here with profile still null.
      if (!useAuthStore.getState().profile) {
        await finalizeAccount({ userId: session.user.id, username, email, phone, firebaseUid: firebaseUid ?? '' });
      }
      setBackupCodes(codes);
    } catch (e: any) {
      appAlert('Verification failed', e?.message ?? 'Incorrect code — check your authenticator app and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const onFinish = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      await useAuthStore.getState().refreshProfile();
      registerForPushNotifications(session.user.id).catch(() => {});
    }
    reset();
    router.replace('/(tabs)/chats');
  };

  if (backupCodes) {
    return (
      <ScreenScaffold>
        <AuthHeader title="Save your backup codes" subtitle="Each code works once and lets you in if you lose your authenticator app. Store them somewhere safe — this is the only time they'll be shown. Long-press to copy." showBack={false} />
        <Glass radius={18} variant="field" style={{ marginTop: 24, padding: 18 }}>
          {backupCodes.map((c) => (
            <Text key={c} selectable style={{ fontFamily: fontFamilies.semibold, fontSize: 16, letterSpacing: 1, color: tokens.text, paddingVertical: 6 }}>
              {c}
            </Text>
          ))}
        </Glass>
        <PrimaryButton title="I've saved these — finish setup" onPress={onFinish} style={{ marginTop: 26 }} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <AuthHeader title="Set up 2FA" subtitle="Scan this QR code with Google Authenticator, Authy, FreeOTP, or any other TOTP app." showBack={false} />

      <View style={{ marginTop: 24, alignItems: 'center' }}>
        {enrolling ? (
          <ActivityIndicator color={tokens.text} style={{ marginVertical: 40 }} />
        ) : enrollment ? (
          <>
            <Glass radius={18} variant="field" style={{ padding: 16 }}>
              <View style={{ width: 220, height: 220, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <SvgXml xml={enrollment.qrCodeSvg} width={220} height={220} />
              </View>
            </Glass>
            <Text style={{ marginTop: 16, fontSize: 12, fontFamily: fontFamilies.medium, color: tokens.text3, textAlign: 'center' }}>Can't scan? Enter this key manually:</Text>
            <Text selectable style={{ marginTop: 4, fontSize: 13, fontFamily: fontFamilies.semibold, color: tokens.text2, letterSpacing: 1, textAlign: 'center' }}>
              {enrollment.secret}
            </Text>
          </>
        ) : (
          <Text style={{ color: tokens.text2, fontFamily: fontFamilies.medium }}>Couldn't load setup — check your connection and go back.</Text>
        )}
      </View>

      <View style={{ marginTop: 26 }}>
        <GlassField label="6-digit code" placeholder="123456" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} style={{ letterSpacing: 6, fontSize: 20 }} />
      </View>
      <PrimaryButton title="Verify & enable 2FA" onPress={onVerify} loading={verifying} disabled={!enrollment} style={{ marginTop: 22 }} />
    </ScreenScaffold>
  );
}
