import React from 'react';
import { ScrollView, View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Android runs edge-to-edge (confirmed via react-native-is-edge-to-edge in
// the dependency tree, and mandatory on the SDK level this app targets) —
// system status/gesture-nav bars are translucent overlays drawn ON TOP of
// app content, not reserved space the app's layout gets to assume is
// empty. That means two things a plain insets.bottom/insets.top padding
// number doesn't fully cover: (1) content needs a healthy fixed buffer
// beyond the reported inset, in case it's under-measured on a given
// device/OS build, and (2) a "fade" scrim needs to be genuinely opaque for
// most of its height — a ~55% translucent gradient still reads as visible,
// overlapping text, not a clean hide.
const EXTRA_EDGE_BUFFER = 28;

export function ScreenScaffold({ children, scroll = true, padded = true, tabBar = false, style }: ScreenScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const Container = scroll ? ScrollView : View;
  const tabBarExtra = tabBar ? TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + TAB_BAR_TOP_MARGIN : 0;
  const bottomClearance = insets.bottom + EXTRA_EDGE_BUFFER + tabBarExtra;
  const containerProps = scroll
    ? { contentContainerStyle: { paddingBottom: 24 + bottomClearance }, showsVerticalScrollIndicator: false }
    : { style: { flex: 1 } };

  const scrimColor = mode === 'light' ? '250,250,253' : '6,6,8';
  const topScrimHeight = insets.top + EXTRA_EDGE_BUFFER;
  const bottomScrimHeight = insets.bottom + EXTRA_EDGE_BUFFER;

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
        <Container
          {...(containerProps as any)}
          style={[
            padded && { paddingHorizontal: 18, paddingTop: insets.top + 14 },
            !scroll && { flex: 1, paddingBottom: bottomClearance },
            style,
          ]}
        >
          {children}
        </Container>
      </Animated.View>
      {/* Status-bar scrim: near-opaque for most of its height (not a soft
          ~55% fade — that still reads as overlapping text), only fading to
          transparent in its last few pixels, so scrolled content is
          genuinely hidden under the system status bar rather than
          legible-but-dimmed through it. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: undefined, height: topScrimHeight }]}>
        <LinearGradient
          colors={[`rgba(${scrimColor},0.97)`, `rgba(${scrimColor},0.97)`, 'transparent']}
          locations={[0, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Matching bottom scrim for screens with no floating tab bar (its
          own floor already does this) — Settings/Privacy/Help/etc. had
          nothing here at all, so the last element could sit under the
          system gesture-nav bar with only a hard content edge, no buffer. */}
      {!tabBar && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bottomScrimHeight }}>
          <LinearGradient
            colors={['transparent', `rgba(${scrimColor},0.97)`, `rgba(${scrimColor},0.97)`]}
            locations={[0, 0.28, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </View>
  );
}
