import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, Easing, FadeIn } from 'react-native-reanimated';
import { BokehBackground } from '../src/components/BokehBackground';
import { Avatar } from '../src/components/Avatar';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';
import { useGroupCallStore } from '../src/state/groupCallStore';
import { useGroupStore } from '../src/state/groupStore';
import { useContactStore } from '../src/state/contactStore';

// FILE PURPOSE: The full-screen incoming-group-call UI — parallel to
// app/incoming-call.tsx (1:1) — deliberately a separate screen
// rather than branching that one, since the two have different data shapes
// (one caller vs. a roster) and this whole feature is meant to be an
// additive path alongside 1:1 calling, not a modification of it.
// Ring: same pulsing-ring avatar-border animation as incoming-call.tsx's
// own Ring (duplicated intentionally, same reasoning as above).
function Ring({ delay }: { delay: number }) {
  const { a1 } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: 0.8 - t.value * 0.8, transform: [{ scale: 1 + t.value * 0.9 }] }));
  return <Animated.View style={[{ position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: a1 }, style]} />;
}

// Renders the caller/roster info and accept/decline controls for an
// incoming group call.
export default function IncomingGroupCallScreen() {
  const { tokens } = useTheme();
  const incoming = useGroupCallStore((s) => s.incoming);
  const phase = useGroupCallStore((s) => s.phase);
  const accept = useGroupCallStore((s) => s.accept);
  const decline = useGroupCallStore((s) => s.decline);
  const group = useGroupStore((s) => (incoming ? s.groups[incoming.groupId] : undefined));
  const approved = useContactStore((s) => s.approved);

  // Resolves a userId to a display name for the "X is calling" text.
  const nameFor = (uid: string) => approved.find((c) => c.id === uid)?.display_name || approved.find((c) => c.id === uid)?.username || 'Someone';
  const callerName = incoming ? nameFor(incoming.from) : '';
  const otherCount = incoming ? incoming.participantIds.length - 1 : 0; // everyone but self

  useEffect(() => {
    // Same reasoning as incoming-call.tsx's identical effect: `incoming`
    // also goes null the instant accept() fires (phase moves to
    // 'connecting' in that same set() call), not just on decline/timeout/
    // caller-hangup — the phase check keeps this from popping the in-call
    // screen that _layout.tsx's subscriber just pushed for the accept case.
    if (!incoming && phase !== 'connecting') router.back();
  }, [incoming, phase]);

  if (!incoming) return null;

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <Animated.View entering={FadeIn} style={{ flex: 1, alignItems: 'center', paddingTop: 118, paddingHorizontal: 30, paddingBottom: 56 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#34d27b" strokeWidth={2.4}>
            <Path d="M4 11h16v10H4z" />
            <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </Svg>
          <Text style={{ fontSize: 14, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Encrypted Current group call</Text>
        </View>

        <View style={{ marginTop: 50, width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
          <Ring delay={0} />
          <Ring delay={1000} />
          <Avatar hue={approved.find((c) => c.id === incoming.from)?.avatar_hue ?? 265} photoUrl={approved.find((c) => c.id === incoming.from)?.avatar_url} size={148} ringWidth={4} label={callerName} />
        </View>

        <Text style={{ fontSize: 28, fontFamily: fontFamilies.black, color: tokens.text, marginTop: 34, textAlign: 'center' }}>{group?.name ?? 'Group call'}</Text>
        <Text style={{ fontSize: 15, fontFamily: fontFamilies.medium, color: tokens.text2, marginTop: 6, textAlign: 'center' }}>
          {callerName} is calling{otherCount > 1 ? ` (+${otherCount - 1} more)` : ''} · {incoming.kind}
        </Text>

        <View style={{ marginTop: 'auto', width: '100%', flexDirection: 'row', justifyContent: 'space-evenly' }}>
          <View style={{ alignItems: 'center', gap: 9 }}>
            <Pressable onPress={decline}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e0354b', alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" style={{ transform: [{ rotate: '135deg' }] }}>
                  <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
                </Svg>
              </View>
            </Pressable>
            <Text style={{ fontSize: 12, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Decline</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 9 }}>
            <Pressable onPress={accept}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#15a55c', alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                  <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
                </Svg>
              </View>
            </Pressable>
            <Text style={{ fontSize: 12, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Accept</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
