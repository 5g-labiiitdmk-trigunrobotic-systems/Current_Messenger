import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

// FILE PURPOSE: Two small shared text presets used across screens —
// ScreenTitle (a large glowing heading, used at the top of each main
// tab) and Label (a small uppercase section-header style, used in lists
// throughout the app).
export function ScreenTitle({ children, size = 33, style, ...rest }: TextProps & { size?: number }) {
  const { tokens } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: size,
          fontFamily: fontFamilies.black,
          letterSpacing: -1,
          color: tokens.text,
          textShadowColor: tokens.glowColor,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 16,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Small uppercase section-header label.
export function Label({ children, style, ...rest }: TextProps) {
  const { tokens } = useTheme();
  return (
    <Text {...rest} style={[{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8 }, style]}>
      {children}
    </Text>
  );
}
