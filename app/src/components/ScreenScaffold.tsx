import React from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BokehBackground } from './BokehBackground';
import { TAB_BAR_HEIGHT, TAB_BAR_BOTTOM_GAP, TAB_BAR_TOP_MARGIN } from './TabBar';

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
  const Container = scroll ? ScrollView : View;
  const tabBarExtra = tabBar ? TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + TAB_BAR_TOP_MARGIN : 0;
  const bottomClearance = insets.bottom + EXTRA_EDGE_BUFFER + tabBarExtra;

  // Still drives content's paddingTop below — only the scrim gradient that
  // used to render alongside it was removed (see git history: it recurred
  // as a bug covering interactive elements like Settings' Logout button
  // even after being scoped to only-when-scrollable, so it was cut rather
  // than patched again).
  const topScrimHeight = insets.top + EXTRA_EDGE_BUFFER;

  const containerProps = scroll
    ? {
        contentContainerStyle: { paddingBottom: 24 + bottomClearance },
        showsVerticalScrollIndicator: false,
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
    </View>
  );
}
