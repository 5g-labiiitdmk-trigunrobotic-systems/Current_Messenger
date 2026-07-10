import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/state/authStore';
import { getTotpFactor, verifyTotpLogin } from '../../src/lib/totp';
import { consumeBackupCode } from '../../src/lib/backupCodes';
import { appAlert } from '../../src/state/alertStore';

/**
 * Login-time TOTP challenge. Runs after a successful password sign-in
 * whenever the account has an enrolled TOTP factor (see login.tsx). A
 * backup code is an alternate path for this app's own gate only — it can't
 * elevate Supabase's own session AAL, since backup codes aren't a Supabase
 * Auth concept (see backupCodes.ts).
 */
export default function TotpVerifyScreen() {
  const { tokens, a1 } = useTheme();
  const session = useAuthStore((s) => s.session);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const factor = await getTotpFactor();
        if (!factor) {
          // No TOTP enrolled after all — nothing to challenge, let them through.
          router.replace('/(tabs)/chats');
          return;
        }
        setFactorId(factor.id);
      } catch (e: any) {
        appAlert('Could not load 2FA status', e?.message ?? 'Please try again.');
      } finally {
        setLoadingFactor(false);
      }
    })();
  }, []);

  const onVerify = async () => {
    if (!session) return;
    if (!code.trim()) {
      appAlert('Enter a code', useBackup ? 'Type one of your backup codes.' : 'Type the 6-digit code from your authenticator app.');
      return;
    }
    setVerifying(true);
    try {
      if (useBackup) {
        const ok = await consumeBackupCode(session.user.id, code.trim());
        if (!ok) throw new Error('That backup code is invalid or already used.');
      } else {
        if (!factorId) throw new Error('2FA factor not loaded — please try again.');
        await verifyTotpLogin(factorId, code.trim());
      }
      useAuthStore.setState({ mfaVerified: true });
      router.replace('/(tabs)/chats');
    } catch (e: any) {
      appAlert('Verification failed', e?.message ?? 'Incorrect code.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Two-factor check" subtitle={useBackup ? 'Enter one of your saved backup codes.' : 'Enter the 6-digit code from your authenticator app.'} showBack={false} />

      {loadingFactor ? (
        <ActivityIndicator color={tokens.text} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={{ marginTop: 28 }}>
            <GlassField
              label={useBackup ? 'Backup code' : '6-digit code'}
              placeholder={useBackup ? 'XXXXX-XXXXX' : '123456'}
              keyboardType={useBackup ? 'default' : 'number-pad'}
              autoCapitalize={useBackup ? 'characters' : 'none'}
              maxLength={useBackup ? 11 : 6}
              value={code}
              onChangeText={setCode}
              style={{ letterSpacing: 4, fontSize: 20 }}
            />
          </View>
          <PrimaryButton title="Verify" onPress={onVerify} loading={verifying} style={{ marginTop: 22 }} />
          <Pressable
            onPress={() => {
              setUseBackup((v) => !v);
              setCode('');
            }}
            style={{ marginTop: 18, alignSelf: 'center' }}
          >
            <Text style={{ fontFamily: fontFamilies.bold, fontSize: 13.5, color: a1 }}>
              {useBackup ? 'Use authenticator code instead' : "Lost your authenticator? Use a backup code"}
            </Text>
          </Pressable>
        </>
      )}
    </ScreenScaffold>
  );
}
