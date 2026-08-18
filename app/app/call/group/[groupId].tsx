import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BokehBackground } from '../../../src/components/BokehBackground';
import { Avatar } from '../../../src/components/Avatar';
import { fontFamilies } from '../../../src/theme/tokens';
import { useTheme } from '../../../src/theme/useTheme';
import { useGroupCallStore, type GroupCallParticipant, type ParticipantStatus } from '../../../src/state/groupCallStore';
import { useGroupStore } from '../../../src/state/groupStore';
import { useContactStore } from '../../../src/state/contactStore';
import { useAuthStore } from '../../../src/state/authStore';
import { RTCView } from '../../../src/lib/webrtc';

// Parallel screen to app/call/[id].tsx (1:1) — a grid layout instead of
// full-bleed-remote + PIP-local, since group calls have no single "the
// other party" to fill the screen. Deliberately its own file/route
// (/call/group/[groupId], per docs/GROUP_CALLING.md's suggested shape)
// rather than branching call/[id].tsx on participant count, so the
// existing 1:1 screen stays exactly as it was.

const END_REASON_LABEL: Record<string, string> = {
  hangup: 'Call ended',
  'all-declined': 'No one answered',
  'no-answer': 'No answer',
  network: 'Call dropped — network issue',
  failed: "Couldn't connect",
};

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  ringing: 'Ringing…',
  connecting: 'Connecting…',
  connected: '',
  declined: 'Declined',
  'no-answer': 'No answer',
  busy: 'Busy',
  left: 'Left',
  failed: 'Connection failed',
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

function ParticipantTile({
  participant,
  name,
  hue,
  photoUrl,
  showVideo,
  width,
  height,
}: {
  participant: GroupCallParticipant;
  name: string;
  hue: number;
  photoUrl?: string | null;
  showVideo: boolean;
  width: `${number}%`;
  height: `${number}%`;
}) {
  const hasVideo = showVideo && !!participant.stream;
  return (
    <View style={{ width, height, padding: 3 }}>
      <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#16161a', alignItems: 'center', justifyContent: 'center' }}>
        {hasVideo ? (
          <RTCView streamURL={(participant.stream as any).toURL()} style={StyleSheet.absoluteFill} objectFit="cover" mirror={participant.isSelf} />
        ) : (
          <Avatar hue={hue} photoUrl={photoUrl} size={64} label={name} />
        )}
        <View style={{ position: 'absolute', left: 8, bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontFamily: fontFamilies.bold, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>
            {name}
          </Text>
          {STATUS_LABEL[participant.status] ? (
            <Text style={{ fontSize: 10.5, fontFamily: fontFamilies.semibold, color: 'rgba(255,255,255,0.85)', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>
              {STATUS_LABEL[participant.status]}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function GroupCallScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const phase = useGroupCallStore((s) => s.phase);
  const activeGroupId = useGroupCallStore((s) => s.groupId);
  const kind = useGroupCallStore((s) => s.kind);
  const endReason = useGroupCallStore((s) => s.endReason);
  const participants = useGroupCallStore((s) => s.participants);
  const muted = useGroupCallStore((s) => s.muted);
  const cameraOff = useGroupCallStore((s) => s.cameraOff);
  const connectedAt = useGroupCallStore((s) => s.connectedAt);
  const hangup = useGroupCallStore((s) => s.hangup);
  const toggleMute = useGroupCallStore((s) => s.toggleMute);
  const toggleCamera = useGroupCallStore((s) => s.toggleCamera);
  const clearEnded = useGroupCallStore((s) => s.clearEnded);
  const group = useGroupStore((s) => s.groups[groupId ?? '']);
  const approved = useContactStore((s) => s.approved);
  const self = useAuthStore((s) => s.session?.user.id);
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

  // Same defensive guard as call/[id].tsx: this screen has no
  // accept/decline, only in-call controls — never the first thing an
  // invitee sees for a call they haven't accepted yet.
  useEffect(() => {
    if (phase === 'ringing-in') {
      router.replace('/incoming-group-call');
    }
  }, [phase]);

  const nameFor = (uid: string) => (uid === self ? 'You' : approved.find((c) => c.id === uid)?.display_name || approved.find((c) => c.id === uid)?.username || 'Member');
  const contactFor = (uid: string) => approved.find((c) => c.id === uid);

  const statusText = phase === 'ringing-out' ? 'Calling…' : phase === 'connecting' ? 'Connecting…' : phase === 'active' ? formatDuration(elapsed) : phase === 'ended' ? (endReason ? END_REASON_LABEL[endReason] ?? 'Call ended' : 'Call ended') : '';

  const list = Object.values(participants);
  const columns = list.length <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(list.length / columns));
  const tileWidth = `${100 / columns}%` as `${number}%`;
  const tileHeight = `${100 / rows}%` as `${number}%`;

  // Defensive: if this screen is somehow reached for a different group's
  // call (or no call at all), fall back rather than rendering someone
  // else's roster — router.back() below (via the idle effect) handles the
  // "no call at all" case; this covers "wrong groupId" specifically.
  if (activeGroupId && groupId && activeGroupId !== groupId) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0c' }}>
      <BokehBackground />

      <Pressable
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 10, left: 14, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 9l-6 6-6-6" />
        </Svg>
      </Pressable>

      <View style={{ position: 'absolute', top: insets.top + 14, left: 0, right: 0, alignItems: 'center', zIndex: 5 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: fontFamilies.heavy, color: '#fff' }}>{group?.name ?? 'Group call'}</Text>
        <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.semibold, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{statusText}</Text>
      </View>

      <View style={{ flex: 1, paddingTop: insets.top + 60, paddingBottom: 130, paddingHorizontal: 6 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
          {list.map((p) => (
            <ParticipantTile
              key={p.userId}
              participant={p}
              name={nameFor(p.userId)}
              hue={contactFor(p.userId)?.avatar_hue ?? 265}
              photoUrl={contactFor(p.userId)?.avatar_url}
              showVideo={kind === 'video' && !(p.isSelf && cameraOff)}
              width={tileWidth}
              height={tileHeight}
            />
          ))}
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
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
          <ControlButton onPress={hangup} danger>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" style={{ transform: [{ rotate: '135deg' }] }}>
              <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
            </Svg>
          </ControlButton>
          <Text style={styles.label}>Leave</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: fontFamilies.semibold, color: 'rgba(255,255,255,0.85)' },
});
