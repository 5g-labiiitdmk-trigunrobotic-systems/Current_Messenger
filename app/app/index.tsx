import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, Easing, FadeIn } from 'react-native-reanimated';
import { BokehBackground } from '../src/components/BokehBackground';
import { TypingDots } from '../src/components/TypingDots';
import { useTheme } from '../src/theme/useTheme';
import { useAuthStore } from '../src/state/authStore';

const SPLASH_HOLD_MS = 3000;

export default function SplashRoute() {
  const { tokens, a1 } = useTheme();
  const initializing = useAuthStore((s) => s.initializing);
  const session = useAuthStore((s) => s.session);
  const needsProfileSetup = useAuthStore((s) => s.needsProfileSetup);

  const scale = useSharedValue(0.72);
  const opacity = useSharedValue(0);
  const halo = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    scale.value = withSequence(
      withTiming(1.04, { duration: 500, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(1, { duration: 220 })
    );
    halo.value = withTiming(1, { duration: 900 });
    float.value = withDelay(900, withRepeat(withSequence(withTiming(-6, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1, false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (initializing) return;
      if (!session) router.replace('/(auth)/onboarding');
      else if (needsProfileSetup) router.replace('/(auth)/finish-setup');
      else router.replace('/(tabs)/chats');
    }, SPLASH_HOLD_MS);
    return () => clearTimeout(t);
  }, [initializing, session, needsProfileSetup]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: float.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: halo.value * 0.6,
    transform: [{ scale: 0.6 + halo.value * 0.55 }],
  }));

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.halo, { backgroundColor: tokens.orbColor }, haloStyle]} />
          <Animated.View style={[styles.logoCard, logoStyle]}>
            <Image source={require('../assets/current-logo.png')} style={styles.logoImage} />
          </Animated.View>
        </View>
      </View>
      <Animated.View entering={FadeIn.delay(1400).duration(700)} style={styles.footer}>
        <TypingDots color={a1} />
        <Text style={[styles.kicker, { color: tokens.text3 }]}>a product of</Text>
        <Text style={[styles.brand, { color: tokens.text }]}>Trigun Robotic Systems @ IIITDMK</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 300, height: 300, borderRadius: 150 },
  logoCard: {
    width: 180,
    height: 180,
    borderRadius: 44,
    overflow: 'hidden',
    shadowColor: '#28195c',
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 10,
  },
  logoImage: { width: '100%', height: '100%' },
  footer: { position: 'absolute', bottom: 54, left: 0, right: 0, alignItems: 'center', gap: 12 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: 'Inter_600SemiBold' },
  brand: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2, fontFamily: 'Inter_800ExtraBold' },
});
