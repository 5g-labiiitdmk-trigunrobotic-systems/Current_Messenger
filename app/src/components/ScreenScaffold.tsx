import React from 'react';
import { ScrollView, View, type ViewStyle, type StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BokehBackground } from './BokehBackground';

interface ScreenScaffoldProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  bottomInset?: number; // extra space for floating tab bar
  style?: StyleProp<ViewStyle>;
}

export function ScreenScaffold({ children, scroll = true, padded = true, bottomInset = 0, style }: ScreenScaffoldProps) {
  const insets = useSafeAreaInsets();
  const Container = scroll ? ScrollView : View;
  const containerProps = scroll
    ? { contentContainerStyle: { paddingBottom: 40 + bottomInset }, showsVerticalScrollIndicator: false }
    : { style: { flex: 1 } };

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
        <Container
          {...(containerProps as any)}
          style={[
            padded && { paddingHorizontal: 18, paddingTop: insets.top + 14 },
            !scroll && { flex: 1 },
            style,
          ]}
        >
          {children}
        </Container>
      </Animated.View>
    </View>
  );
}
