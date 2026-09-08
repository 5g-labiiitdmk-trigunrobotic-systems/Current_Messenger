import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassButton } from '../../src/components/Buttons';
import { OtpCodeInput, type OtpInputStatus } from '../../src/components/OtpCodeInput';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { appAlert } from '../../src/state/alertStore';
import { sendOtp, verifyOtp, OTP_CODE_LENGTH } from '../../src/lib/otp';

const RESEND_COOLDOWN_SECONDS = 30;
// How long the shake plays before the row clears and accepts a retry —
// long enough for OtpCodeInput's own shake sequence (see its total
// duration) to fully finish first.
const ERROR_RESET_DELAY_MS = 650;

/**
 * FILE PURPOSE: OTP entry screen — the second of the two new, NOT-YET-
 * WIRED-UP screens (see phone-auth/entry.tsx's own doc comment for the
 * full context). Reached only via a `phone` param from that screen;
 * navigating here directly with no param falls back to a placeholder
 * string purely so the screen still renders for isolated testing.
 *
 * Auto-submits the instant all 6 digits are entered (no separate
 * "Verify" button to tap) — verifyOtp() is fast (mock) or a single quick
 * round-trip (real provider), so waiting for an explicit submit here
 * would just be one extra tap standing between a correct code and being
 * done, the same UX real messaging/banking apps' OTP screens already use.
 */
export default function OtpVerifyScreen() {
  const { tokens, a1 } = useTheme();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const phoneNumber = phone ?? '+91XXXXXXXXXX';

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<OtpInputStatus>('idle');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  // Guards against a second auto-submit firing while one is already in
  // flight (e.g. the user pastes a full 6-digit code while a previous
  // verify() call from a prior attempt hasn't resolved yet).
  const submittingRef = useRef(false);

  // Resend countdown — ticks every second, stops at 0. Reset by
  // onResend() below on every successful resend.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Auto-submits the instant the row is fully filled.
  useEffect(() => {
    if (code.length === OTP_CODE_LENGTH && !submittingRef.current && status !== 'success') {
      submittingRef.current = true;
      setVerifying(true);
      verifyOtp(phoneNumber, code).then((result) => {
        setVerifying(false);
        submittingRef.current = false;
        if (result.ok) {
          setStatus('success');
        } else {
          setStatus('error');
          appAlert('Incorrect code', result.error ?? 'That code is incorrect.');
          setTimeout(() => {
            setCode('');
            setStatus('idle');
          }, ERROR_RESET_DELAY_MS);
        }
      });
    }
  }, [code]);

  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    const result = await sendOtp(phoneNumber);
    setResending(false);
    if (!result.ok) {
      appAlert('Could not resend code', result.error ?? 'Something went wrong — try again.');
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    appAlert('Code sent', `A new code was sent to ${phoneNumber}.`);
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Enter the code" subtitle={`We sent a ${OTP_CODE_LENGTH}-digit code to ${phoneNumber}.`} />

      <View style={{ marginTop: 36 }}>
        <OtpCodeInput value={code} onChangeText={setCode} status={status} autoFocus />
      </View>

      {status === 'success' ? (
        <View style={{ marginTop: 28, alignItems: 'center', gap: 18 }}>
          <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text, textAlign: 'center' }}>Phone verified</Text>
          <Text style={{ fontSize: 13, fontFamily: fontFamilies.regular, color: tokens.text3, textAlign: 'center', paddingHorizontal: 10 }}>
            Standalone test screen — this isn't connected to your account yet. See docs/SETUP.md for what activating this for real requires.
          </Text>
          <GlassButton title="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/phone-auth/entry'))} style={{ width: '100%' }} />
        </View>
      ) : (
        <View style={{ marginTop: 28, alignItems: 'center' }}>
          {verifying ? (
            <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.semibold, color: tokens.text3 }}>Checking...</Text>
          ) : cooldown > 0 ? (
            <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.semibold, color: tokens.text3 }}>Resend code in 0:{String(cooldown).padStart(2, '0')}</Text>
          ) : (
            <Text onPress={onResend} style={{ fontSize: 13.5, fontFamily: fontFamilies.bold, color: a1 }}>
              {resending ? 'Sending...' : 'Resend code'}
            </Text>
          )}
        </View>
      )}
    </ScreenScaffold>
  );
}
