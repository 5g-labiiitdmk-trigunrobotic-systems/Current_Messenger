import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass } from './Glass';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

interface PrimaryButtonProps {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  height?: number;
}

export function PrimaryButton({ title, onPress, style, disabled, loading, height = 56 }: PrimaryButtonProps) {
  const { a1, a2 } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}>
      <LinearGradient
        colors={[a1, a2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.primary,
          { height, opacity: disabled ? 0.5 : 1, shadowColor: a2 },
        ]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{title}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

interface GlassButtonProps {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
  icon?: React.ReactNode;
}

export function GlassButton({ title, onPress, style, height = 56, icon }: GlassButtonProps) {
  const { tokens } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}>
      <Glass radius={20} variant="bg2" style={{ height }}>
        <SkinnedRow height={height}>
          {icon}
          <Text style={[styles.glassText, { color: tokens.text }]}>{title}</Text>
        </SkinnedRow>
      </Glass>
    </Pressable>
  );
}

function SkinnedRow({ children, height }: { children: React.ReactNode; height: number }) {
  return (
    <Pressable style={{ height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} pointerEvents="none">
      {children}
    </Pressable>
  );
}

interface IconCircleProps {
  onPress?: () => void;
  size?: number;
  children: React.ReactNode;
  variant?: 'bg' | 'bg2' | 'accent' | 'transparent';
  style?: StyleProp<ViewStyle>;
}

export function IconCircle({ onPress, size = 42, children, variant = 'bg', style }: IconCircleProps) {
  const { a1, a2 } = useTheme();
  if (variant === 'accent') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.92 : 1 }] }, style]}>
        <LinearGradient
          colors={[a1, a2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', shadowColor: a2, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}
        >
          {children}
        </LinearGradient>
      </Pressable>
    );
  }
  if (variant === 'transparent') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.9 : 1 }] }, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.92 : 1 }] }, style]}>
      <Glass radius={size / 2} variant={variant} style={{ width: size, height: size }}>
        <Pressable style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          {children}
        </Pressable>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  primaryText: { color: '#fff', fontSize: 16.5, fontFamily: fontFamilies.bold },
  glassText: { fontSize: 16, fontFamily: fontFamilies.bold },
});
