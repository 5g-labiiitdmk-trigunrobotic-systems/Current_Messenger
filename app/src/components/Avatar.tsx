import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { avatarGradient, fontFamilies } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface AvatarProps {
  hue: number;
  size?: number;
  online?: boolean;
  photoUrl?: string | null;
  ringWidth?: number;
  /** Display name or username — renders as initials instead of the generic
   * silhouette icon, matching how the source design's avatars are designed
   * (not a bare "unfinished" placeholder). Falls back to the silhouette when
   * no name is available yet (e.g. still loading). */
  label?: string;
}

function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({ hue, size = 54, online, photoUrl, ringWidth = 2, label }: AvatarProps) {
  const { tokens } = useTheme();
  const [c1, c2] = avatarGradient(hue);
  const iconSize = size * 0.7;
  const initials = label ? initialsFor(label) : '';

  return (
    <View style={{ width: size, height: size }}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <LinearGradient
          colors={[c1, c2]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
        >
          {initials ? (
            <Text style={{ fontSize: size * 0.36, fontFamily: fontFamilies.bold, color: 'rgba(255,255,255,0.95)' }}>{initials}</Text>
          ) : (
            <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" style={{ opacity: 0.88, position: 'absolute', bottom: 0 }}>
              <Circle cx="12" cy="9" r="4" fill="rgba(255,255,255,0.9)" />
              <Path d="M4 23c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" fill="rgba(255,255,255,0.9)" />
            </Svg>
          )}
        </LinearGradient>
      )}
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
