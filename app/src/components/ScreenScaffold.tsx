import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, KeyboardAvoidingView, Platform, type ViewStyle, type StyleProp, type LayoutChangeEvent } from 'react-native';
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

  const scrimColor = mode === 'light' ? '250,250,253' : '6,6,8';
  const topScrimHeight = insets.top + EXTRA_EDGE_BUFFER;
  const bottomScrimHeight = insets.bottom + EXTRA_EDGE_BUFFER;

  // The bottom scrim exists to mask content that has scrolled UNDER the
  // system gesture-nav bar — it's only ever meaningful if there's actually
  // something to scroll. On a short screen (e.g. Settings, whose content
  // can fit without scrolling on most devices), the scrim was previously
  // always rendered anyway as a fixed overlay pinned to the screen's
  // bottom edge, regardless of scroll state — so whatever static, already-
  // fully-visible content happened to land in that zone (the Log Out
  // button, in Settings' case) got permanently washed out by a near-opaque
  // white/black gradient sitting on top of it, with no scrolling able to
  // reveal it since there was nothing to scroll. Tracking whether content
  // actually overflows the viewport and only rendering the scrim then
  // fixes this at the root, for every screen built on ScreenScaffold, not
  // just Settings.
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const canScroll = scroll && contentHeight > viewportHeight;

  const containerProps = scroll
    ? {
        contentContainerStyle: { paddingBottom: 24 + bottomClearance },
        showsVerticalScrollIndicator: false,
        onContentSizeChange: (_w: number, h: number) => setContentHeight(h),
        onLayout: (e: LayoutChangeEvent) => setViewportHeight(e.nativeEvent.layout.height),
      }
    : { style: { flex: 1 } };

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      {/* Every screen built on ScreenScaffold gets keyboard avoidance for
          free — this was previously missing entirely at the shared level,
          which meant every screen with a text input (login, signup,
          settings, new-group, contacts search, ...) individually had the
          same "input hidden behind the open keyboard" bug the chat screens
          had before their own fix. 'height' on Android, not 'padding' —
          'padding' mode double-offsets there when combined with the OS's
          own resize behavior; see the identical fix in chat/[id].tsx. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
          <Container
            {...(containerProps as any)}
            style={[
              // Must fully clear topScrimHeight, not just insets.top — this
              // used to be insets.top + 14 while the scrim's fade-to-
              // transparent zone extended to insets.top + 28, so the very
              // top of a screen's content (e.g. Settings' accent-color
              // swatches) always rendered partially washed out by the
              // scrim's fade, even completely unscrolled.
              padded && { paddingHorizontal: 18, paddingTop: topScrimHeight + 6 },
              !scroll && { flex: 1, paddingBottom: bottomClearance },
              style,
            ]}
          >
            {children}
          </Container>
        </Animated.View>
      </KeyboardAvoidingView>
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
          system gesture-nav bar with only a hard content edge, no buffer.
          Only rendered once content is confirmed to overflow the viewport
          — see canScroll's own comment above. */}
      {!tabBar && canScroll && (
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
