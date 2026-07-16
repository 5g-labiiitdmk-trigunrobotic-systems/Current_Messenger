import React, { useState } from 'react';
import { View, Text, Image, Pressable, Modal } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Glass } from './Glass';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';
import type { ChatMessage } from '../state/chatStore';
import { playAudioBase64 } from '../lib/media';

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  meId?: string;
  senderName?: string;
  onLongPress?: () => void;
  onVote?: (optionIndex: number) => void;
}

export function MessageBubble({ message: m, isMe, meId, senderName, onLongPress, onVote }: MessageBubbleProps) {
  const { tokens, a1, a2 } = useTheme();
  if (m.deleted) {
    return (
      <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginVertical: 2 }}>
        <Text style={{ fontStyle: 'italic', color: tokens.text3, fontFamily: fontFamilies.medium, fontSize: 13 }}>Message deleted</Text>
      </View>
    );
  }

  const bubbleStyle = isMe
    ? { backgroundColor: undefined }
    : { backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder };

  const reactionEntries = Object.entries(m.reactions ?? {});

  const content = (
    <>
      {senderName && <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.bold, color: a1, marginLeft: 4, marginBottom: 3 }}>{senderName}</Text>}
      <Pressable onLongPress={onLongPress} delayLongPress={280}>
        <BubbleContent m={m} isMe={isMe} a1={a1} a2={a2} tokens={tokens} meId={meId} onVote={onVote} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
          {m.edited && <Text style={{ fontSize: 10, color: tokens.text3, fontFamily: fontFamilies.medium }}>edited</Text>}
          <Text style={{ fontSize: 10.5, color: tokens.text3, fontFamily: fontFamilies.semibold }}>{timeLabel(m.sentAt)}</Text>
          {isMe && <ReadReceipt status={m.status} color={a1} />}
        </View>
        {reactionEntries.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 2, marginTop: 3, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
            {reactionEntries.slice(0, 6).map(([uid, emoji]) => (
              <Text key={uid} style={{ fontSize: 13 }}>
                {emoji}
              </Text>
            ))}
          </View>
        )}
      </Pressable>
    </>
  );

  return (
    <Animated.View entering={FadeInUp.duration(280)} style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      <View style={{ maxWidth: '78%' }}>{content}</View>
    </Animated.View>
  );
}

function BubbleContent({ m, isMe, a1, a2, tokens, meId, onVote }: any) {
  if (m.kind === 'sticker' && m.meta?.emoji) {
    return (
      <View style={{ paddingHorizontal: 4, paddingVertical: 2 }}>
        <Text style={{ fontSize: 56 }}>{m.meta.emoji}</Text>
      </View>
    );
  }
  if (m.kind === 'poll' && m.meta?.question) {
    const options: string[] = m.meta.options ?? [];
    const votes: Record<string, number> = m.meta.votes ?? {};
    const tally = options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
    const total = Object.values(votes).length;
    const myVote = meId ? votes[meId] : undefined;
    return (
      <View style={[{ borderRadius: 20, padding: 16, minWidth: 220 }, isMe ? { backgroundColor: a1 } : { backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder }]}>
        <Text style={{ fontFamily: fontFamilies.bold, color: isMe ? '#fff' : tokens.text, fontSize: 14 }}>📊 {m.meta.question}</Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {options.map((opt, i) => {
            const pct = total > 0 ? Math.round((tally[i] / total) * 100) : 0;
            const selected = myVote === i;
            return (
              <Pressable key={i} onPress={() => onVote?.(i)}>
                <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: isMe ? 'rgba(255,255,255,0.18)' : tokens.field, borderWidth: selected ? 1.5 : 0, borderColor: '#fff' }}>
                  <View style={{ height: 30, width: `${pct}%`, backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : a1, position: 'absolute' }} />
                  <View style={{ height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                    <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.semibold, color: isMe ? '#fff' : tokens.text }}>{opt}</Text>
                    <Text style={{ fontSize: 11, fontFamily: fontFamilies.bold, color: isMe ? '#fff' : tokens.text2 }}>{pct}%</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ fontSize: 10.5, marginTop: 8, color: isMe ? 'rgba(255,255,255,0.7)' : tokens.text3, fontFamily: fontFamilies.medium }}>
          {total} vote{total === 1 ? '' : 's'} · live this session only
        </Text>
      </View>
    );
  }
  if (m.kind === 'voice') {
    const play = () => {
      if (m.meta?.base64) playAudioBase64(String(m.meta.base64), String(m.meta.mime ?? 'audio/m4a')).catch(() => {});
    };
    return (
      <Pressable onPress={play} style={{ borderRadius: 22, borderBottomRightRadius: isMe ? 7 : 22, borderBottomLeftRadius: isMe ? 22 : 7, overflow: 'hidden' }}>
        {isMe ? (
          <View style={{ backgroundColor: a1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <VoiceRow color="rgba(255,255,255,0.85)" playBg="rgba(255,255,255,0.25)" playFill="#fff" dur={String(m.meta?.durationLabel ?? '0:05')} durCol="rgba(255,255,255,0.85)" />
          </View>
        ) : (
          <Glass radius={22} style={{ padding: 13 }}>
            <VoiceRow color={a1} playBg={a1} playFill="#fff" dur={String(m.meta?.durationLabel ?? '0:05')} durCol={tokens.text2} />
          </Glass>
        )}
      </Pressable>
    );
  }
  if (m.kind === 'media' && m.meta?.base64) {
    return (
      <View style={{ borderRadius: 20, overflow: 'hidden' }}>
        <Image source={{ uri: `data:${m.meta.mime ?? 'image/jpeg'};base64,${m.meta.base64}` }} style={{ width: 220, height: 220 }} resizeMode="cover" />
      </View>
    );
  }
  if (m.kind === 'location' && m.meta) {
    return <LocationBubble meta={m.meta} isMe={isMe} a1={a1} tokens={tokens} />;
  }
  return (
    <View
      style={[
        { borderRadius: 22, paddingHorizontal: 15, paddingVertical: 11, borderBottomRightRadius: isMe ? 7 : 22, borderBottomLeftRadius: isMe ? 22 : 7 },
        isMe ? { backgroundColor: a1 } : { backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder },
      ]}
    >
      {m.replyToId && (
        <View style={{ borderLeftWidth: 2, borderLeftColor: isMe ? 'rgba(255,255,255,0.6)' : a1, paddingLeft: 8, marginBottom: 6 }}>
          <Text style={{ fontSize: 11.5, color: isMe ? 'rgba(255,255,255,0.75)' : tokens.text2, fontFamily: fontFamilies.medium }}>Replying to a message</Text>
        </View>
      )}
      <MentionText text={m.text ?? ''} baseColor={isMe ? '#fff' : tokens.text} mentionColor={isMe ? '#fff' : a1} isMe={isMe} />
    </View>
  );
}

/**
 * One-shot location share (see getCurrentLocationOnce in src/lib/media.ts —
 * there is no live/continuous tracking, this is a single point in time
 * captured once and sent like any other rich message). Preview map is
 * non-interactive (scroll/zoom/rotate disabled) so it doesn't fight the
 * chat list's own scroll gesture; tapping it opens a real interactive map
 * in a full-screen Modal, mirroring AppAlertHost's Modal usage elsewhere
 * in this app.
 */
function LocationBubble({ meta, isMe, a1, tokens }: { meta: any; isMe: boolean; a1: string; tokens: any }) {
  const [expanded, setExpanded] = useState(false);
  const lat = Number(meta.lat);
  const lng = Number(meta.lng);
  const region = { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  return (
    <>
      <Pressable onPress={() => setExpanded(true)} style={{ borderRadius: 20, overflow: 'hidden', width: 220 }}>
        <MapView
          style={{ width: 220, height: 140 }}
          initialRegion={region}
          pointerEvents="none"
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} />
        </MapView>
        <View
          style={[
            { paddingHorizontal: 12, paddingVertical: 10 },
            isMe ? { backgroundColor: a1 } : { backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder, borderTopWidth: 0 },
          ]}
        >
          <Text style={{ fontFamily: fontFamilies.bold, color: isMe ? '#fff' : tokens.text, fontSize: 13.5 }}>📍 Location</Text>
          <Text style={{ fontFamily: fontFamilies.medium, color: isMe ? 'rgba(255,255,255,0.85)' : tokens.text2, fontSize: 12, marginTop: 2 }}>
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </Text>
        </View>
      </Pressable>
      <Modal visible={expanded} animationType="fade" onRequestClose={() => setExpanded(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <MapView style={{ flex: 1 }} initialRegion={region}>
            <Marker coordinate={{ latitude: lat, longitude: lng }} />
          </MapView>
          <Pressable
            onPress={() => setExpanded(false)}
            style={{ position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontFamily: fontFamilies.bold }}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const MENTION_SPLIT_RE = /(@[a-z0-9_.]{2,24})/gi;
const MENTION_TEST_RE = /^@[a-z0-9_.]{2,24}$/i;

function MentionText({ text, baseColor, mentionColor, isMe }: { text: string; baseColor: string; mentionColor: string; isMe: boolean }) {
  const parts = text.split(MENTION_SPLIT_RE);
  return (
    <Text style={{ fontSize: 14.5, lineHeight: 20, fontFamily: fontFamilies.regular }}>
      {parts.map((part, i) =>
        MENTION_TEST_RE.test(part) ? (
          <Text key={i} style={{ color: mentionColor, fontFamily: fontFamilies.bold, textDecorationLine: isMe ? 'underline' : 'none' }}>
            {part}
          </Text>
        ) : (
          <Text key={i} style={{ color: baseColor }}>
            {part}
          </Text>
        )
      )}
    </Text>
  );
}

function VoiceRow({ color, playBg, playFill, dur, durCol }: any) {
  const bars = [9, 17, 24, 13, 20, 8, 15, 22, 11, 18, 7, 14];
  return (
    <>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: playBg, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill={playFill}>
          <Path d="M7 5l12 7-12 7V5Z" />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 26 }}>
        {bars.map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: color }} />
        ))}
      </View>
      <Text style={{ fontSize: 12, fontFamily: fontFamilies.semibold, color: durCol }}>{dur}</Text>
    </>
  );
}

function ReadReceipt({ status, color }: { status: ChatMessage['status']; color: string }) {
  if (status === 'sending') return <Text style={{ fontSize: 10, color }}>○</Text>;
  if (status === 'failed') return <Text style={{ fontSize: 11, color: '#ff5a6e', fontFamily: fontFamilies.bold }}>Failed</Text>;
  const readColor = status === 'read' ? color : 'rgba(150,150,160,0.6)';
  return (
    <Svg width={15} height={11} viewBox="0 0 24 16" fill="none" stroke={readColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 8l5 5L15 3" />
      <Path d="M9 12l1 1L22 3" />
    </Svg>
  );
}
