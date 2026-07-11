import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { Glass } from '../../src/components/Glass';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useSignupStore } from '../../src/state/signupStore';
import { useAuthStore } from '../../src/state/authStore';
import { supabase } from '../../src/lib/supabase';
import { appAlert } from '../../src/state/alertStore';

/**
 * Supabase's default "Confirm signup" email is a clickable link, not a
 * code (a code-based template needs custom SMTP, which we're skipping for
 * now). So this screen doesn't collect anything — it just waits. Tapping
 * the link in the email opens the app via a deep link, which
 * app/_layout.tsx + src/lib/authDeepLink.ts handle globally by calling
 * supabase.auth.setSession(...), which updates `session` here reactively.
 * finish-setup.tsx does the actual account finalization + routing to the
 * main app — this screen just waits for email_confirmed_at to flip.
 */
// Supabase's own default mailer (no custom SMTP configured — see
// docs/SETUP.md) throttles resend requests for the same address; repeatedly
// tapping "Resend" the moment it fails just re-triggers that same limit and
// makes it look permanently broken. This client-side cooldown is a UX
// safeguard, not a workaround for the limit itself — if resend keeps
// failing even after waiting, that's a Supabase-dashboard SMTP setup issue,
// not something fixable from here.
const RESEND_COOLDOWN_SEC = 60;

export default function VerifyEmailScreen() {
  const { tokens, a1 } = useTheme();
  const email = useSignupStore((s) => s.email);
  const session = useAuthStore((s) => s.session);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (session?.user.email_confirmed_at) {
      router.replace('/(auth)/finish-setup');
    }
  }, [session]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]);

  const onResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) {
      appAlert('Could not resend', error.message);
      // Even a failed attempt likely still counted against Supabase's own
      // rate limit — start the cooldown regardless so the next tap doesn't
      // immediately re-fail the same way.
      setCooldown(RESEND_COOLDOWN_SEC);
    } else {
      appAlert('Email sent', `A new confirmation link was sent to ${email}. Tap it to continue.`);
      setCooldown(RESEND_COOLDOWN_SEC);
    }
  };

  const disabled = resending || cooldown > 0;

  return (
    <ScreenScaffold>
      <AuthHeader title="Check your email" subtitle={`We sent a confirmation link to ${email || 'your email'}.`} />

      <Glass radius={22} style={{ marginTop: 26, padding: 18, flexDirection: 'row', gap: 13, alignItems: 'flex-start' }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9} style={{ marginTop: 1 }}>
          <Path d="M4 4h16v16H4z" />
          <Path d="M4 6l8 7 8-7" />
        </Svg>
        <Text style={{ flex: 1, fontSize: 13, fontFamily: fontFamilies.medium, color: tokens.text2, lineHeight: 19 }}>
          Open the email on this device and tap the confirmation link — it'll bring you straight back here, already verified. This screen updates itself, no need to come back and refresh.
        </Text>
      </Glass>

      <Text onPress={disabled ? undefined : onResend} style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, fontFamily: fontFamilies.bold, color: disabled ? tokens.text3 : a1 }}>
        {resending ? 'Sending…' : cooldown > 0 ? `Resend available in ${cooldown}s` : "Didn't get it? Resend email"}
      </Text>
    </ScreenScaffold>
  );
}
