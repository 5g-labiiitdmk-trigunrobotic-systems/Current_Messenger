import React from 'react';
import { View, Pressable, Text } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Glass } from './Glass';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';

const ICONS: Record<string, (color: string) => React.ReactNode> = {
  chats: (c) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-4-.9L3 21l1.9-4.5A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
    </Svg>
  ),
  calls: (c) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </Svg>
  ),
  contacts: (c) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </Svg>
  ),
  profile: (c) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </Svg>
  ),
};

const LABELS: Record<string, string> = { chats: 'Chats', calls: 'Calls', contacts: 'Contacts', profile: 'Profile' };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { tokens, a1 } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ position: 'absolute', left: 18, right: 18, bottom: insets.bottom + 8 }}>
      <Glass radius={22} variant="bg2" style={{ height: 66 }}>
        <View style={{ flexDirection: 'row', height: 66, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8 }}>
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const color = focused ? a1 : tokens.text2;
            return (
              <Pressable
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={({ pressed }) => [{ alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 14, transform: [{ scale: pressed ? 0.9 : 1 }] }]}
              >
                {ICONS[route.name]?.(color)}
                <Text style={{ fontSize: 10, fontFamily: fontFamilies.bold, color }}>{LABELS[route.name] ?? route.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
