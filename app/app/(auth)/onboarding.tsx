import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { Mascot } from '../../src/components/Mascot';
import { Glass } from '../../src/components/Glass';
import { ShimmerSweep } from '../../src/components/ShimmerSweep';
import { PrimaryButton, GlassButton } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';

export default function OnboardingScreen() {
  const { tokens } = useTheme();
  return (
    <ScreenScaffold padded={false}>
      <View style={styles.wrap}>
        <Mascot size={128} />
        <Text style={[styles.title, { color: tokens.text, textShadowColor: tokens.glowColor }]}>Current</Text>
        <Text style={[styles.tagline, { color: tokens.text2 }]}>Private messaging, simplified</Text>

        <Glass radius={30} style={{ width: '100%', marginTop: 40, padding: 22 }}>
          <ShimmerSweep />
          <Text style={[styles.cardTitle, { color: tokens.text }]}>End-to-end encrypted by default</Text>
          <Text style={[styles.cardBody, { color: tokens.text2 }]}>
            Your conversations are sealed — only you and the people you trust hold the keys. Nothing is ever stored, even by us.
          </Text>
        </Glass>

        <PrimaryButton title="Create account" onPress={() => router.push('/(auth)/signup')} style={{ width: '100%', marginTop: 26 }} />
        <GlassButton title="Log in" onPress={() => router.push('/(auth)/login')} style={{ width: '100%', marginTop: 12 }} />

        <View style={styles.replay} onTouchEnd={() => router.replace('/')}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={tokens.text3} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M1 4v6h6M23 20v-6h-6" />
            <Path d="M20.5 9A9 9 0 0 0 5.6 5.6L1 10M23 14l-4.6 4.4A9 9 0 0 1 3.5 15" />
          </Svg>
          <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.semibold, color: tokens.text3 }}>Replay intro</Text>
        </View>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingTop: 70, paddingBottom: 50 },
  title: { fontSize: 46, fontFamily: fontFamilies.black, letterSpacing: -1.5, marginTop: 18, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 16 },
  tagline: { fontSize: 17, fontFamily: fontFamilies.medium, marginTop: 8 },
  cardTitle: { fontSize: 14, fontFamily: fontFamilies.semibold },
  cardBody: { fontSize: 12.5, fontFamily: fontFamilies.regular, marginTop: 5, lineHeight: 18 },
  replay: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
});
