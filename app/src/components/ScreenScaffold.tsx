import React from 'react';
import { ScrollView, View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BokehBackground } from './BokehBackground';
import { TAB_BAR_HEIGHT, TAB_BAR_BOTTOM_GAP, TAB_BAR_TOP_MARGIN } from './TabBar';
import { useTheme } from '../theme/useTheme';

interface ScreenScaffoldProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Screen is rendered under the floating tab bar — pad scroll content to
   * clear it. Computed from TabBar's own exported dimensions (not a
   * hand-copied number) so the two can never drift out of sync. */
  tabBar?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ScreenScaffold({ children, scroll = true, padded = true, tabBar = false, style }: ScreenScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const Container = scroll ? ScrollView : View;
  // The tab bar is absolutely positioned and reserves no navigator layout
  // space, so scroll content must manually clear insets.bottom (the same
  // safe-area value the bar itself is anchored to) + its gap + its own
  // height, plus a bit of margin so the last row isn't flush against it.
  const tabBarClearance = tabBar ? insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + TAB_BAR_TOP_MARGIN : 0;
  const containerProps = scroll
    ? { contentContainerStyle: { paddingBottom: 24 + tabBarClearance }, showsVerticalScrollIndicator: false }
    : { style: { flex: 1 } };

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
        <Container
          {...(containerProps as any)}
          style={[
            padded && { paddingHorizontal: 18, paddingTop: insets.top + 14 },
            !scroll && { flex: 1, paddingBottom: tabBarClearance },
            style,
          ]}
        >
          {children}
        </Container>
      </Animated.View>
      {/* Status-bar scrim: once scrolled, later content reaches all the way
          to y=0 and sits directly under system status bar icons (mirrors
          the bottom tab-bar floor — same fade-under treatment, not a hard
          collision). Sized smaller than the header's own top offset
          (insets.top + 14) so it doesn't wash out the header at rest. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: undefined, height: insets.top + 22 }]}>
        <BlurView intensity={30} tint={mode === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[mode === 'light' ? 'rgba(255,255,255,0.55)' : 'rgba(8,8,10,0.6)', 'transparent']}
          locations={[0, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}
