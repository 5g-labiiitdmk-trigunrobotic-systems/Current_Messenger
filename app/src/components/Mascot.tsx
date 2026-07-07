import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * The Trusty/Current lock mascot: rounded body, smiley face, small arms.
 * Pure View/SVG-free reconstruction of the CSS shapes in Current.dc.html.
 */
export function Mascot({ size = 128, animated = true }: { size?: number; animated?: boolean }) {
  const scale = size / 128;
  const rotate = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    rotate.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(4, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    lift.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [animated]);

  const wiggleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }, { translateY: lift.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size * 1.16 }, wiggleStyle]}>
      {/* shackle */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: size * 0.5 - size * 0.29,
          width: size * 0.58,
          height: size * 0.48,
          borderWidth: size * 0.1,
          borderColor: '#cfcadf',
          borderBottomWidth: 0,
          borderTopLeftRadius: size * 0.29,
          borderTopRightRadius: size * 0.29,
        }}
      />
      {/* body */}
      <LinearGradient
        colors={['#8d6dff', '#5b3ddf']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: size * 0.5 - size * 0.477,
          width: size * 0.953,
          height: size * 0.78,
          borderRadius: size * 0.234,
        }}
      >
        {/* eyes */}
        <View style={{ position: 'absolute', top: size * 0.234, left: size * 0.234, width: size * 0.11, height: size * 0.14, borderRadius: size * 0.06, backgroundColor: '#fff' }} />
        <View style={{ position: 'absolute', top: size * 0.234, right: size * 0.234, width: size * 0.11, height: size * 0.14, borderRadius: size * 0.06, backgroundColor: '#fff' }} />
        {/* smile */}
        <View
          style={{
            position: 'absolute',
            top: size * 0.406,
            left: size * 0.5 - size * 0.477 * 0.5,
            width: size * 0.234,
            height: size * 0.117,
            borderWidth: size * 0.023,
            borderColor: '#fff',
            borderTopWidth: 0,
            borderBottomLeftRadius: size * 0.14,
            borderBottomRightRadius: size * 0.14,
          }}
        />
        {/* cheeks */}
        <View style={{ position: 'absolute', top: size * 0.36, left: size * 0.14, width: size * 0.11, height: size * 0.07, borderRadius: 999, backgroundColor: 'rgba(255,140,170,0.5)' }} />
        <View style={{ position: 'absolute', top: size * 0.36, right: size * 0.14, width: size * 0.11, height: size * 0.07, borderRadius: 999, backgroundColor: 'rgba(255,140,170,0.5)' }} />
      </LinearGradient>
      {/* arms */}
      <LinearGradient
        colors={['#8d6dff', '#5b3ddf']}
        style={{
          position: 'absolute',
          top: size * 0.47,
          left: -size * 0.1,
          width: size * 0.14,
          height: size * 0.25,
          borderRadius: size * 0.08,
          transform: [{ rotate: '14deg' }],
        }}
      />
      <LinearGradient
        colors={['#8d6dff', '#5b3ddf']}
        style={{
          position: 'absolute',
          top: size * 0.47,
          right: -size * 0.1,
          width: size * 0.14,
          height: size * 0.25,
          borderRadius: size * 0.08,
          transform: [{ rotate: '-14deg' }],
        }}
      />
    </Animated.View>
  );
}
