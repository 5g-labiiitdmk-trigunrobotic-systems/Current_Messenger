import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface GlassProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  variant?: 'bg' | 'bg2' | 'field';
  bordered?: boolean;
}

/**
 * Solid elevation-tone panel. Depth comes from a flat tone difference
 * between elevation levels (Material 3 dark-theme convention) plus a thin
 * hairline border — no blur, no inset highlight/shadow gradients, no
 * outer glow. This replaced a BlurView-based "Liquid Glass" treatment
 * that had a persistent, unresolved ghost-rectangle rendering bug on
 * Android across four separate fix attempts (blurMethod tuning, removing
 * BlurView on Android only, a navigation-transition fix). Going fully
 * solid on both platforms — not just Android — removes the entire
 * native-blur-surface bug class instead of continuing to chase it.
 */
export function Glass({ children, style, radius = 22, variant = 'bg', bordered = true }: GlassProps) {
  const { tokens } = useTheme();
  const fill = variant === 'bg2' ? tokens.glassBg2 : variant === 'field' ? tokens.field : tokens.glassBg;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: fill,
          borderWidth: bordered ? 1 : 0,
          borderColor: tokens.glassBorder,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
