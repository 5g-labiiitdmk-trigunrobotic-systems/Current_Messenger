import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useGroupCallStore } from '../state/groupCallStore';
import { useGroupStore } from '../state/groupStore';
import { fontFamilies } from '../theme/tokens';

/**
 * FILE PURPOSE / component doc: Group-call counterpart to ActiveCallBanner.tsx — deliberately a separate
 * component (not that one extended to branch on call type) so the existing
 * 1:1 banner stays untouched. Same "tap to return" pattern, mounted
 * alongside it at the app root (see _layout.tsx).
 */
export function GroupActiveCallBanner() {
  const phase = useGroupCallStore((s) => s.phase);
  const groupId = useGroupCallStore((s) => s.groupId);
  const kind = useGroupCallStore((s) => s.kind);
  const group = useGroupStore((s) => (groupId ? s.groups[groupId] : undefined));
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isOngoing = phase === 'ringing-out' || phase === 'connecting' || phase === 'active';
  const onCallScreen = pathname === `/call/group/${groupId}`;
  if (!isOngoing || !groupId || onCallScreen) return null;

  const name = group?.name ?? 'Group call';
  const label = phase === 'active' ? `On ${kind} call with ${name}` : phase === 'connecting' ? 'Connecting…' : `Calling ${name}…`;

  return (
    <Pressable onPress={() => router.push(`/call/group/${groupId}`)} style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 998 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#1fae63',
          borderRadius: 20,
          paddingVertical: 9,
          paddingHorizontal: 14,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
          <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
        </Svg>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: fontFamilies.bold, color: '#fff' }}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: fontFamilies.heavy, color: 'rgba(255,255,255,0.85)' }}>Tap to return</Text>
      </View>
    </Pressable>
  );
}
