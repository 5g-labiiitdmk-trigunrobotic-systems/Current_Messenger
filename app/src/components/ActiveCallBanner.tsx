import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useCallStore } from '../state/callStore';
import { useContactStore } from '../state/contactStore';
import { fontFamilies } from '../theme/tokens';

/**
 * Persistent "return to call" indicator — mounted once at the app root
 * (see _layout.tsx), same pattern as AppAlertHost, so it floats over
 * whatever screen the user navigates to (a chat, contacts, settings...)
 * while a call is in progress but not the thing currently on screen.
 * Pairs with the minimize button added to call/[id].tsx — that button is
 * what actually lets the user leave the call screen without hanging up;
 * this is how they get back.
 */
export function ActiveCallBanner() {
  const phase = useCallStore((s) => s.phase);
  const peerId = useCallStore((s) => s.peerId);
  const kind = useCallStore((s) => s.kind);
  const contact = useContactStore((s) => s.approved.find((c) => c.id === peerId));
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // 'ringing-in' is intentionally excluded — that's the incoming-call
  // screen's own full-screen takeover (app/incoming-call.tsx), not
  // something this banner should also announce. Everything else that
  // isn't idle/ended is a call this device is actively part of.
  const isOngoing = phase === 'ringing-out' || phase === 'connecting' || phase === 'active';
  const onCallScreen = pathname === `/call/${peerId}`;
  if (!isOngoing || !peerId || onCallScreen) return null;

  const name = contact?.display_name || contact?.username || 'Call';
  const label = phase === 'active' ? `On ${kind} call with ${name}` : phase === 'connecting' ? 'Connecting…' : `Calling ${name}…`;

  return (
    <Pressable onPress={() => router.push(`/call/${peerId}`)} style={{ position: 'absolute', top: insets.top + 6, left: 12, right: 12, zIndex: 998 }}>
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
