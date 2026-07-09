import React from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../src/components/ScreenScaffold';
import { Glass } from '../src/components/Glass';
import { IconCircle } from '../src/components/Buttons';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';

const SUPPORT_EMAIL = 'trigunroboticsystems@gmail.com';

const FAQ = [
  { q: 'Is anything I send ever stored?', a: 'No. Messages relay live between devices and are never written to a database — not encrypted, not temporarily, not anywhere. If both people aren’t online at once, the message fails to send rather than queuing.' },
  { q: 'Why do I need to approve contact requests?', a: 'Nobody can message you until you approve their request. This is enforced by the relay server itself, not just hidden in the app UI.' },
  { q: 'What does the Privacy Dashboard’s "Active devices" list show?', a: 'Each row is a device that has published an encryption key for your account. It only grows when you actually sign in from a new device.' },
];

export default function HelpScreen() {
  const { tokens, a1 } = useTheme();

  const onContact = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Current app support')}`;
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert('No email app found', `Reach us directly at ${SUPPORT_EMAIL}`);
      return;
    }
    Linking.openURL(url);
  };

  return (
    <ScreenScaffold>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 26, fontFamily: fontFamilies.black, color: tokens.text }}>Help & Support</Text>
      </View>

      <Pressable onPress={onContact}>
        <Glass radius={22} style={{ marginTop: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: a1, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
              <Path d="M4 4h16v16H4z" />
              <Path d="M4 6l8 7 8-7" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text }}>Contact us</Text>
            <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.medium, marginTop: 2 }}>{SUPPORT_EMAIL}</Text>
          </View>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tokens.text3} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 18l6-6-6-6" />
          </Svg>
        </Glass>
      </Pressable>

      <Text style={{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8, margin: 4, marginTop: 22, marginBottom: 10 }}>FAQ</Text>
      <Glass radius={22} style={{ overflow: 'hidden' }}>
        {FAQ.map((item, i) => (
          <View key={item.q} style={{ padding: 16, borderBottomWidth: i === FAQ.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
            <Text style={{ fontSize: 14, fontFamily: fontFamilies.bold, color: tokens.text }}>{item.q}</Text>
            <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.regular, marginTop: 6, lineHeight: 18 }}>{item.a}</Text>
          </View>
        ))}
      </Glass>

      <Text style={{ textAlign: 'center', marginTop: 24, fontSize: 12, fontFamily: fontFamilies.medium, color: tokens.text3 }}>
        Current — a product of Trigun Robotic Systems @ IIITDMK
      </Text>
    </ScreenScaffold>
  );
}
