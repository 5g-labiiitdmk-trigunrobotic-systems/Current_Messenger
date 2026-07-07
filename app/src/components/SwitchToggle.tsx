import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/useTheme';

export function SwitchToggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  const { tokens, a1, a2 } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 220 });
  }, [value]);

  const knobStyle = useAnimatedStyle(() => ({
    left: 3 + progress.value * 21,
  }));

  const track = (
    <View style={{ width: 52, height: 31, borderRadius: 16, overflow: 'hidden' }}>
      {value ? (
        <LinearGradient colors={[a1, a2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      ) : (
        <View style={{ flex: 1, backgroundColor: tokens.field, borderWidth: 1, borderColor: tokens.glassBorder }} />
      )}
    </View>
  );

  return (
    <Pressable onPress={onChange} hitSlop={8}>
      <View style={{ width: 52, height: 31, borderRadius: 16 }}>
        {track}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 3,
              width: 25,
              height: 25,
              borderRadius: 13,
              backgroundColor: '#fff',
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            },
            knobStyle,
          ]}
        />
      </View>
    </Pressable>
  );
}
