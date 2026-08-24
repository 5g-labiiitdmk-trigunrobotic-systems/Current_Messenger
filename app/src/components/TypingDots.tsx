import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

// One bouncing/fading dot — `delay` staggers each of the three dots
// (see render below) so they bounce in sequence rather than together.
function Dot({ delay, color, size = 8 }: { delay: number; color: string; size?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0, { duration: 480 })), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + t.value * 0.6,
    transform: [{ translateY: -t.value * 5 }],
  }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/**
 * FILE PURPOSE: The classic three-dot "typing…" indicator — used for
 * both the splash screen's loading state and the chat screen's "other
 * person is typing" indicator.
 */
export function TypingDots({ color, size = 8, gap = 5 }: { color: string; size?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      <Dot delay={0} color={color} size={size} />
      <Dot delay={200} color={color} size={size} />
      <Dot delay={400} color={color} size={size} />
    </View>
  );
}
