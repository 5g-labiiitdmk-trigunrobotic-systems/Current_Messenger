import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * FILE PURPOSE: Subtle moving specular sweep across large glass panels,
 * like light off a curved lens. Purely decorative — a diagonal
 * gradient strip that continuously translates across the full width of
 * its parent, absolute-positioned and non-interactive.
 */
export function ShimmerSweep({ width = 260 }: { width?: number }) {
  const t = useSharedValue(0);
  // Loops the sweep's horizontal position from just off-screen-left to
  // well past the right edge, forever.
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + t.value * (width * 3.5) }, { rotate: '8deg' }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View style={[{ position: 'absolute', top: '-40%', width: width * 0.36, height: '180%' }, style]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </Animated.View>
  );
}
