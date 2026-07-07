import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

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

export function Label({ children, style, ...rest }: TextProps) {
  const { tokens } = useTheme();
  return (
    <Text {...rest} style={[{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8 }, style]}>
      {children}
    </Text>
  );
}
