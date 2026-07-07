import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { IconCircle } from './Buttons';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

export function AuthHeader({ title, subtitle, showBack = true }: { title: string; subtitle?: string; showBack?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View>
      {showBack && (
        <IconCircle onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/onboarding'))}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
      )}
      <Text style={[styles.title, { color: tokens.text, textShadowColor: tokens.glowColor, marginTop: showBack ? 24 : 0 }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: tokens.text2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontFamily: fontFamilies.black, letterSpacing: -1, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 16 },
  subtitle: { fontSize: 14.5, fontFamily: fontFamilies.regular, marginTop: 6 },
});
