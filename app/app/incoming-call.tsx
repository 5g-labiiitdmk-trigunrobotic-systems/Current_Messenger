import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, Easing, FadeIn } from 'react-native-reanimated';
import { BokehBackground } from '../src/components/BokehBackground';
import { Avatar } from '../src/components/Avatar';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';
import { useCallStore } from '../src/state/callStore';
import { useContactStore } from '../src/state/contactStore';

function Ring({ delay }: { delay: number }) {
  const { a1 } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: 0.8 - t.value * 0.8, transform: [{ scale: 1 + t.value * 0.9 }] }));
  return <Animated.View style={[{ position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: a1 }, style]} />;
}

export default function IncomingCallScreen() {
  const { tokens } = useTheme();
  const incoming = useCallStore((s) => s.incoming);
  const phase = useCallStore((s) => s.phase);
  const accept = useCallStore((s) => s.accept);
  const decline = useCallStore((s) => s.decline);
  const contact = useContactStore((s) => s.approved.find((c) => c.id === incoming?.from));

  useEffect(() => {
    // `incoming` also goes null the moment accept() fires (phase moves to
    // 'connecting' in the same set() call) — not just on decline/timeout/
    // caller-cancel. _layout.tsx's subscriber already replaces this screen
    // with /call/[id] for that case; without the phase check here, this
    // effect's own router.back() fires right after and pops that call
    // screen straight back off, landing the receiver on whatever screen
    // was underneath instead of the in-call UI.
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
          <Text style={{ fontSize: 14, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Encrypted Current call</Text>
        </View>

        <View style={{ marginTop: 50, width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
          <Ring delay={0} />
          <Ring delay={1000} />
          <Avatar hue={contact?.avatar_hue ?? 265} photoUrl={contact?.avatar_url} size={148} ringWidth={4} label={contact?.display_name || contact?.username} />
        </View>

        <Text style={{ fontSize: 30, fontFamily: fontFamilies.black, color: tokens.text, marginTop: 34 }}>{contact?.display_name ?? contact?.username ?? 'Unknown'}</Text>
        <Text style={{ fontSize: 15, fontFamily: fontFamilies.medium, color: tokens.text2, marginTop: 6 }}>Current {incoming.kind} call…</Text>

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
