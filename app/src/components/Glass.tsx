import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/useTheme';

interface GlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  variant?: 'bg' | 'bg2' | 'field';
  bordered?: boolean;
  shadow?: boolean;
  intensity?: number;
}

/** Frosted glass panel: BlurView + translucent fill + bright bevel edge + soft outer shadow. */
export function Glass({
  children,
  style,
  radius = 22,
  variant = 'bg',
  bordered = true,
  shadow = true,
  intensity = 26,
}: GlassProps) {
  const { tokens, mode } = useTheme();
  const fill = variant === 'bg2' ? tokens.glassBg2 : variant === 'field' ? tokens.field : tokens.glassBg;
  // Approximates the source design's --g-sh: a real box-shadow can layer an
  // inset highlight + inset shadow + outer glow at once; RN can't do inset
  // shadows or multiple shadows on one node, so the outer glow is a native
  // shadow (stronger/theme-aware to match `0 12px 34px rgba(0,0,0,.55)` in
  // dark mode) and the two inset edges are simulated with a pair of corner
  // gradients (light top-left, dark bottom-right) layered inside the panel.
  const outerShadow = mode === 'light' ? styles.shadowLight : styles.shadowDark;

  return (
    <View
      style={[
        // Android bug: `elevation` on a transparent View (no backgroundColor)
        // draws the shadow as an unclipped rectangle instead of respecting
        // borderRadius — the actual visible fill is a separate absolutely-
        // positioned child below, so without this the shadow's rounded
        // silhouette has nothing non-transparent to derive its shape from,
        // and bleeds out past the rounded corners. `fill` is already
        // low-alpha (the glass tint), so this changes nothing visually.
        { borderRadius: radius, overflow: 'hidden', backgroundColor: fill },
        shadow && outerShadow,
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={mode === 'light' ? 'light' : 'dark'}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: fill,
            borderRadius: radius,
            borderWidth: bordered ? 1 : 0,
            borderColor: tokens.glassBorder,
          },
        ]}
      />
      {/* top-left bevel highlight — simulates light hitting the glass edge */}
      <LinearGradient
        pointerEvents="none"
        colors={[tokens.bevelHighlight, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: mode === 'light' ? 0.35 : 0.18, borderRadius: radius }]}
      />
      {/* bottom-right inset shadow — grounds the panel the way a real inset shadow would */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', tokens.bevelShadow]}
        start={{ x: 0.35, y: 0.35 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: mode === 'light' ? 0.5 : 0.7, borderRadius: radius }]}
      />
      <View style={{ borderRadius: radius }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  shadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 14,
  },
});
