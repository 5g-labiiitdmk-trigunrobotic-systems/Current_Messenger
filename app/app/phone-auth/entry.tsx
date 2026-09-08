import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { router } from 'expo-router';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { AuthHeader } from '../../src/components/AuthHeader';
import { GlassField } from '../../src/components/GlassField';
import { Glass } from '../../src/components/Glass';
import { PrimaryButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { appAlert } from '../../src/state/alertStore';
import { sendOtp } from '../../src/lib/otp';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, NATIONAL_NUMBER_LENGTH, DEFAULT_NATIONAL_NUMBER_LENGTH, type CountryCode } from '../../src/data/countryCodes';

/**
 * FILE PURPOSE: Phone number entry screen — the first of two new,
 * NOT-YET-WIRED-UP screens (see this screen's own route, and
 * phone-auth/verify.tsx) that exist so phone/OTP verification can be
 * built and tested ahead of an activation decision, without touching the
 * live signup/login flow at all. Nothing in the app currently links here
 * — reach it only by navigating directly to /phone-auth/entry (e.g. by
 * typing it into Expo Router's dev deep link, or temporarily adding a
 * button somewhere during testing). See docs/SETUP.md's "Phone/OTP
 * verification" section for the full activation checklist.
 *
 * Country selector + national number, validated to a plausible per-
 * country digit-length range (see src/data/countryCodes.ts) before ever
 * calling sendOtp() — the real gate is always the OTP round-trip itself,
 * this is just enough client-side validation to avoid an obviously-wrong
 * number wasting a send attempt.
 */
export default function PhoneEntryScreen() {
  const { tokens } = useTheme();
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY_CODE);
  const [nationalNumber, setNationalNumber] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const digitsOnly = nationalNumber.replace(/\D/g, '');
  const range = NATIONAL_NUMBER_LENGTH[country.iso2] ?? DEFAULT_NATIONAL_NUMBER_LENGTH;
  const isValidLength = digitsOnly.length >= range.min && digitsOnly.length <= range.max;

  const onSubmit = async () => {
    if (!digitsOnly) {
      appAlert('Enter your number', 'Type your phone number to continue.');
      return;
    }
    if (!isValidLength) {
      appAlert(
        'That number looks off',
        range.min === range.max
          ? `${country.name} numbers are ${range.min} digits long.`
          : `${country.name} numbers are ${range.min}-${range.max} digits long.`
      );
      return;
    }
    const fullNumber = `${country.dialCode}${digitsOnly}`;
    setSending(true);
    const result = await sendOtp(fullNumber);
    setSending(false);
    if (!result.ok) {
      appAlert('Could not send code', result.error ?? 'Something went wrong — try again.');
      return;
    }
    router.push({ pathname: '/phone-auth/verify', params: { phone: fullNumber } });
  };

  return (
    <ScreenScaffold>
      <AuthHeader title="Verify your phone" subtitle="We'll text you a 6-digit code to confirm it's really you." />

      <View style={{ marginTop: 30, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => setPickerOpen(true)}>
            <Glass radius={18} variant="field" style={{ paddingHorizontal: 16, height: 62, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                <Text style={{ fontSize: 16, fontFamily: fontFamilies.bold, color: tokens.text }}>{country.dialCode}</Text>
                <ChevronDown color={tokens.text3} />
              </View>
            </Glass>
          </Pressable>
          <View style={{ flex: 1 }}>
            <GlassField
              label="Phone number"
              placeholder="98765 43210"
              keyboardType="number-pad"
              value={nationalNumber}
              onChangeText={setNationalNumber}
              maxLength={range.max + 2}
            />
          </View>
        </View>
      </View>

      <PrimaryButton title="Send code" onPress={onSubmit} loading={sending} style={{ marginTop: 26 }} />

      <CountryPickerModal
        visible={pickerOpen}
        selected={country}
        onSelect={(c) => {
          setCountry(c);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </ScreenScaffold>
  );
}

function ChevronDown({ color }: { color: string }) {
  return (
    <View style={{ marginLeft: 2 }}>
      <Text style={{ color, fontSize: 10 }}>▼</Text>
    </View>
  );
}

// Full-screen country picker — a plain Modal (matching PhotoSendPreview/
// MessageBubble's existing fullscreen-modal fade convention elsewhere in
// this app) over a scrollable list of Glass rows, rather than a native
// <Picker>, so it matches this app's own visual language instead of the
// OS-default picker wheel.
function CountryPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: CountryCode;
  onSelect: (c: CountryCode) => void;
  onClose: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ maxHeight: '70%', backgroundColor: tokens.glassBg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, paddingBottom: 24 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.glassBorder, alignSelf: 'center', marginBottom: 14 }} />
          <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text, paddingHorizontal: 20, marginBottom: 10 }}>Choose a country</Text>
          <FlatList
            data={COUNTRY_CODES}
            keyExtractor={(item) => item.iso2}
            renderItem={({ item }) => (
              <Pressable onPress={() => onSelect(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13 }}>
                <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                <Text style={{ flex: 1, fontSize: 15.5, fontFamily: fontFamilies.medium, color: tokens.text }}>{item.name}</Text>
                <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: item.iso2 === selected.iso2 ? tokens.text : tokens.text3 }}>{item.dialCode}</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
