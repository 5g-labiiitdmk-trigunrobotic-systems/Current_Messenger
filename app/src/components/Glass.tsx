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

  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden' },
        shadow && styles.shadow,
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
      {/* top bevel highlight — simulates light hitting the glass edge */}
      <LinearGradient
        pointerEvents="none"
        colors={[tokens.bevelHighlight, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: mode === 'light' ? 0.35 : 0.18, borderRadius: radius }]}
      />
      <View style={{ borderRadius: radius }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
});
