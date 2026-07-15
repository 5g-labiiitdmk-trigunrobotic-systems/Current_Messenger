import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BokehBackground } from '../../src/components/BokehBackground';
import { Avatar } from '../../src/components/Avatar';
import { fontFamilies } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { useCallStore } from '../../src/state/callStore';
import { useContactStore } from '../../src/state/contactStore';
import { RTCView } from '../../src/lib/webrtc';
import type { AudioRoute } from '../../src/lib/callAudio';
import { appAlert } from '../../src/state/alertStore';

const END_REASON_LABEL: Record<string, string> = {
  hangup: 'Call ended',
  declined: 'Call declined',
  busy: 'They were on another call',
  'no-answer': 'No answer',
  network: 'Call dropped — network issue',
  failed: "Couldn't connect",
};

// Only routes a device can actually ever report — a Bluetooth or wired
// headset entry only appears in availableAudioRoutes when one is genuinely
// connected (see callAudio.ts), so this is just display metadata, not a
// gate on what's offered.
const ROUTE_LABEL: Record<AudioRoute, string> = {
  EARPIECE: 'Earpiece',
  SPEAKER_PHONE: 'Speaker',
  BLUETOOTH: 'Bluetooth',
  WIRED_HEADSET: 'Headset',
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ControlButton({ onPress, active, danger, children }: { onPress: () => void; active?: boolean; danger?: boolean; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? '#e0354b' : active ? tokens.text : 'rgba(255,255,255,0.16)',
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

export default function CallScreen() {
  const phase = useCallStore((s) => s.phase);
  const peerId = useCallStore((s) => s.peerId);
  const kind = useCallStore((s) => s.kind);
  const endReason = useCallStore((s) => s.endReason);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const muted = useCallStore((s) => s.muted);
  const cameraOff = useCallStore((s) => s.cameraOff);
  const audioRoute = useCallStore((s) => s.audioRoute);
  const availableAudioRoutes = useCallStore((s) => s.availableAudioRoutes);
  const connectedAt = useCallStore((s) => s.connectedAt);
  const hangup = useCallStore((s) => s.hangup);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const setAudioRoute = useCallStore((s) => s.setAudioRoute);
  const clearEnded = useCallStore((s) => s.clearEnded);
  const contact = useContactStore((s) => s.approved.find((c) => c.id === peerId));
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'active' || !connectedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase, connectedAt]);

  useEffect(() => {
    if (phase === 'ended') {
      const t = setTimeout(() => {
        clearEnded();
        if (router.canGoBack()) router.back();
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'idle') {
      if (router.canGoBack()) router.back();
    }
  }, [phase]);

  // Defensive guard: this screen has no accept/decline controls, only
  // in-call ones (mute/camera/speaker/hangup) — it must never be the first
  // thing a receiver sees for a call they haven't accepted yet. If it's
  // ever reached while still 'ringing-in' (e.g. a duplicate/late navigation
  // event), bounce to the real ringing screen instead of stranding the
  // user on a screen with no way to answer.
  useEffect(() => {
    if (phase === 'ringing-in') {
      router.replace('/incoming-call');
    }
  }, [phase]);

  const name = contact?.display_name || contact?.username || 'Unknown';
  const isVideo = kind === 'video' && !cameraOff;
  const showRemoteVideo = isVideo && !!remoteStream;

  const statusText =
    phase === 'ringing-out' ? 'Calling…' : phase === 'connecting' ? 'Connecting…' : phase === 'active' ? formatDuration(elapsed) : phase === 'ended' ? (endReason ? END_REASON_LABEL[endReason] ?? 'Call ended' : 'Call ended') : '';

  // WhatsApp-style route picker: only ever lists routes the device reports
  // as actually available right now (see availableAudioRoutes in
  // callStore.ts/callAudio.ts) — a Bluetooth entry only shows up once a
  // Bluetooth audio device is genuinely connected, same as a real dialer.
  const onOpenAudioRoutePicker = () => {
    if (availableAudioRoutes.length === 0) return;
    appAlert(
      'Audio output',
      undefined,
      availableAudioRoutes
        .map((route) => ({
          text: audioRoute === route ? `${ROUTE_LABEL[route]}  ✓` : ROUTE_LABEL[route],
          onPress: () => setAudioRoute(route),
        }))
        .concat([{ text: 'Cancel', style: 'cancel' } as any])
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0c' }}>
      {showRemoteVideo ? (
        <RTCView streamURL={(remoteStream as any).toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <BokehBackground />
      )}

      {/* Minimize — leaves this screen without hanging up, so the call
          keeps running while the user views a chat or anywhere else.
          There was previously no way to do this at all (no back/minimize
          control existed here, and the Stack.Screen for this route sets
          gestureEnabled: false); the persistent ActiveCallBanner
          (src/components/ActiveCallBanner.tsx, mounted globally in
          _layout.tsx) is how the user gets back — without this button,
          that banner would have nothing to be a "return to" for. */}
      <Pressable
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 10, left: 14, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 9l-6 6-6-6" />
        </Svg>
      </Pressable>

      <View style={{ flex: 1, paddingTop: 90, paddingBottom: 50, paddingHorizontal: 24, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#34d27b" strokeWidth={2.4}>
            <Path d="M4 11h16v10H4z" />
            <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </Svg>
          <Text style={{ fontSize: 13, fontFamily: fontFamilies.semibold, color: 'rgba(255,255,255,0.85)' }}>Encrypted Current call</Text>
        </View>

        {!showRemoteVideo && (
          <>
            <View style={{ marginTop: 60 }}>
              <Avatar hue={contact?.avatar_hue ?? 265} photoUrl={contact?.avatar_url} size={140} label={name} />
            </View>
            <Text style={{ fontSize: 28, fontFamily: fontFamilies.black, color: '#fff', marginTop: 26 }}>{name}</Text>
          </>
        )}

        <Text style={{ fontSize: 15, fontFamily: fontFamilies.semibold, color: 'rgba(255,255,255,0.85)', marginTop: showRemoteVideo ? 'auto' : 8 }}>{statusText}</Text>

        {isVideo && localStream && (
          <View
            style={{
              position: 'absolute',
              top: showRemoteVideo ? 60 : undefined,
              bottom: showRemoteVideo ? undefined : 140,
              right: 0,
              width: 104,
              height: 150,
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <RTCView streamURL={(localStream as any).toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror zOrder={1} />
          </View>
        )}

        <View style={{ marginTop: 'auto', width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: 9 }}>
            <ControlButton onPress={toggleMute} active={muted}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={muted ? '#0a0a0c' : '#fff'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                {muted ? (
                  <>
                    <Path d="M1 1l22 22" />
                    <Path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
                    <Path d="M17 16.95A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.11 1.23" />
                  </>
                ) : (
                  <>
                    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </>
                )}
                <Path d="M12 19v4M8 23h8" />
              </Svg>
            </ControlButton>
            <Text style={styles.label}>{muted ? 'Unmute' : 'Mute'}</Text>
          </View>

          {kind === 'video' && (
            <View style={{ alignItems: 'center', gap: 9 }}>
              <ControlButton onPress={toggleCamera} active={cameraOff}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={cameraOff ? '#0a0a0c' : '#fff'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {cameraOff && <Path d="M1 1l22 22" />}
                  <Path d="M23 7l-7 5 7 5V7z" />
                  <Path d="M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
                </Svg>
              </ControlButton>
              <Text style={styles.label}>{cameraOff ? 'Start video' : 'Stop video'}</Text>
            </View>
          )}

          <View style={{ alignItems: 'center', gap: 9 }}>
            <ControlButton onPress={onOpenAudioRoutePicker} active={audioRoute === 'SPEAKER_PHONE' || audioRoute === 'BLUETOOTH'}>
              <Svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke={audioRoute === 'SPEAKER_PHONE' || audioRoute === 'BLUETOOTH' ? '#0a0a0c' : '#fff'}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M11 5L6 9H2v6h4l5 4V5z" />
                <Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </Svg>
            </ControlButton>
            <Text style={styles.label}>{audioRoute ? ROUTE_LABEL[audioRoute] : 'Audio'}</Text>
          </View>

          <View style={{ alignItems: 'center', gap: 9 }}>
            <ControlButton onPress={hangup} danger>
              <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" style={{ transform: [{ rotate: '135deg' }] }}>
                <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
              </Svg>
            </ControlButton>
            <Text style={styles.label}>End</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: fontFamilies.semibold, color: 'rgba(255,255,255,0.85)' },
});
