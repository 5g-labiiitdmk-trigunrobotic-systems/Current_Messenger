import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { PrimaryButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useSignupStore } from '../../src/state/signupStore';
import { supabase } from '../../src/lib/supabase';
import { AUTH_REDIRECT_URL } from '../../src/lib/authDeepLink';
import { appAlert } from '../../src/state/alertStore';
import { normalizeUsername, usernameFormatError, isUsernameTaken } from '../../src/lib/username';

const CHECK_DEBOUNCE_MS = 450;

type AvailabilityState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function SignupScreen() {
  const { tokens, a1 } = useTheme();
  const set = useSignupStore((s) => s.set);
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<AvailabilityState>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Live debounced availability check as the user types — reuses the exact
  // same format/uniqueness rules as the post-signup username-change feature
  // (src/lib/username.ts), not a separate copy of the logic.
  useEffect(() => {
    if (!username.trim()) {
      setAvailability('idle');
      return;
    }
    const formatError = usernameFormatError(username);
    if (formatError) {
      setAvailability('invalid');
      return;
    }
    setAvailability('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      const taken = await isUsernameTaken(normalizeUsername(username));
      if (!cancelled) setAvailability(taken ? 'taken' : 'available');
    }, CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username]);

  const onSubmit = async () => {
    const uname = normalizeUsername(username);
    const formatError = usernameFormatError(uname);
    if (formatError) {
      appAlert('Invalid username', formatError);
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
    if (!agreedToTerms) {
      appAlert('Agreement required', 'Confirm you are 16 or older and agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    if (await isUsernameTaken(uname)) {
      setLoading(false);
      setAvailability('taken');
      appAlert('Username taken', 'Try a different username.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: AUTH_REDIRECT_URL,
        // Durable, not just in-memory: the in-memory signup wizard
        // (signupStore) doesn't survive the app being closed while the
        // user goes to check their email for the confirmation link — a
        // very common path, not an edge case. Supabase stores this on
        // auth.users itself, so finish-setup.tsx can recover the chosen
        // username after a cold-start resume instead of falling back to a
        // random generated one (see usernameGen.ts's own doc comment).
        data: { username: uname },
      },
    });
    setLoading(false);
    if (error) {
      appAlert('Sign up failed', error.message);
      return;
    }
    set({ username: uname, email, password });
    router.push('/(auth)/verify-email');
  };

  const availabilityLabel: Record<AvailabilityState, { text: string; color: string } | null> = {
    idle: null,
    checking: { text: 'Checking availability…', color: tokens.text3 },
    available: { text: '✓ Available', color: '#15a55c' },
    taken: { text: 'Already taken — try another', color: '#ff5a6e' },
    invalid: { text: usernameFormatError(username) ?? '', color: '#ff5a6e' },
  };
  const feedback = availabilityLabel[availability];
  const canSubmit = !loading && availability === 'available' && password.length >= 8 && password === confirm && email.includes('@') && agreedToTerms;

  return (
    <ScreenScaffold>
      <AuthHeader title="Create account" subtitle="We'll email you a confirmation link — verify it to activate your account." />

      <View style={{ marginTop: 28, gap: 14 }}>
        <View>
          <GlassField label="Username" placeholder="@yourname" autoCapitalize="none" value={username} onChangeText={setUsername} />
          <View style={{ minHeight: 18, marginTop: 6, paddingHorizontal: 4 }}>
            {feedback ? (
              <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.semibold, color: feedback.color }}>{feedback.text}</Text>
            ) : (
              <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.medium, color: tokens.text3 }}>
                3-24 characters: lowercase letters, numbers, "_" or "."
              </Text>
            )}
          </View>
        </View>
        <GlassField label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <GlassField label="Password" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} />
        <GlassField label="Confirm password" placeholder="Re-enter password" secureTextEntry value={confirm} onChangeText={setConfirm} />
      </View>

      <Pressable onPress={() => setAgreedToTerms((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            marginTop: 1,
            borderWidth: 1.5,
            borderColor: agreedToTerms ? a1 : tokens.glassBorder,
            backgroundColor: agreedToTerms ? a1 : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {agreedToTerms && (
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
          )}
        </View>
        <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: tokens.text2, fontFamily: fontFamilies.medium }}>
          I confirm I am 16 years of age or older, and I agree to the{' '}
          <Text style={{ color: a1, fontFamily: fontFamilies.bold }} onPress={() => router.push('/legal')}>
            Terms of Service and Privacy Policy
          </Text>
        </Text>
      </Pressable>

      <PrimaryButton title="Continue — verify email" onPress={onSubmit} loading={loading} disabled={!canSubmit} style={{ marginTop: 16 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
        <Text style={{ fontSize: 13.5, color: tokens.text2, fontFamily: fontFamilies.regular }}>Already have an account?</Text>
        <Text style={{ fontSize: 13.5, color: '#7c5cff', fontFamily: fontFamilies.bold }} onPress={() => router.push('/(auth)/login')}>
          Log in
        </Text>
      </View>
    </ScreenScaffold>
  );
}
