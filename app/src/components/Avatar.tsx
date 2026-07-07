import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { avatarGradient } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface AvatarProps {
  hue: number;
  size?: number;
  online?: boolean;
  photoUrl?: string | null;
  ringWidth?: number;
}

export function Avatar({ hue, size = 54, online, ringWidth = 2 }: AvatarProps) {
  const { tokens } = useTheme();
  const [c1, c2] = avatarGradient(hue);
  const iconSize = size * 0.7;

  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={[c1, c2]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'flex-end',
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.5)',
        }}
      >
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" style={{ opacity: 0.88 }}>
          <Circle cx="12" cy="9" r="4" fill="rgba(255,255,255,0.9)" />
          <Path d="M4 23c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" fill="rgba(255,255,255,0.9)" />
        </Svg>
      </LinearGradient>
      {online && (
        <View
          style={[
            styles.dot,
            {
              width: size * 0.26,
              height: size * 0.26,
              borderRadius: size * 0.13,
              right: 0,
              bottom: size * 0.02,
              borderWidth: ringWidth,
              borderColor: tokens.ring,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    backgroundColor: '#34d27b',
  },
});
