import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Modal, Platform, Linking, useWindowDimensions, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Glass } from './Glass';
import { LocationMapSurface } from './LocationMapSurface';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';
import type { ChatMessage } from '../state/chatStore';
import { playAudioBase64 } from '../lib/media';
import { appAlert } from '../state/alertStore';

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
  // The replied-to message's sender label + content preview — looked up by
  // the parent (which has the full thread) from message.replyToId, since
  // this component only ever sees the one message. Undefined/null means
  // either there's no reply, or the referenced message couldn't be found
  // (e.g. deleted locally) — falls back to a generic label in that case.
  replyPreview?: { senderLabel: string; text: string } | null;
}

export function MessageBubble({ message: m, isMe, meId, senderName, onLongPress, onVote, replyPreview }: MessageBubbleProps) {
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
        <BubbleContent m={m} isMe={isMe} a1={a1} a2={a2} tokens={tokens} meId={meId} onVote={onVote} replyPreview={replyPreview} />
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

function BubbleContent({ m, isMe, a1, a2, tokens, meId, onVote, replyPreview }: any) {
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
  if (m.kind === 'media' && m.meta?.base64 && m.meta?.mediaType === 'video') {
    return <VideoMessageBubble meta={m.meta} />;
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
          {replyPreview ? (
            <>
              <Text style={{ fontSize: 11, fontFamily: fontFamilies.bold, color: isMe ? 'rgba(255,255,255,0.9)' : a1 }}>{replyPreview.senderLabel}</Text>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 11.5, color: isMe ? 'rgba(255,255,255,0.75)' : tokens.text2, fontFamily: fontFamilies.medium }}>
                {replyPreview.text}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 11.5, color: isMe ? 'rgba(255,255,255,0.75)' : tokens.text2, fontFamily: fontFamilies.medium }}>Replying to a message</Text>
          )}
        </View>
      )}
      <MentionText text={m.text ?? ''} baseColor={isMe ? '#fff' : tokens.text} mentionColor={isMe ? '#fff' : a1} isMe={isMe} />
    </View>
  );
}

// The actual map surface (tile source + rendering engine) now lives in
// LocationMapSurface.{ios,android,web}.tsx, not inline here — see that
// file set's own comments for the full history (raw OSM raster tiles ->
// MapTiler -> raw OSM raster tiles again -> now OpenFreeMap via MapLibre)
// and exactly why each platform does what it does. This file only keeps
// the fallback/diagnostic UI shell, which doesn't care which renderer is
// behind it.
function openInMaps(lat: number, lng: number) {
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?ll=${lat},${lng}&q=Shared+location` : `geo:${lat},${lng}?q=${lat},${lng}(Shared+location)`;
  Linking.canOpenURL(url).then((can) => {
    if (can) Linking.openURL(url);
    else Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`);
  });
}

// showOpenInMaps: the fallback bubble used to be a dead end — no map
// image AND no way to act on the coordinates either, even though the
// coordinates themselves were received and valid. Added so degraded
// states (config missing, tiles failed to load) still hand off to the
// device's own maps app, same as the real map preview's expanded view
// already does.
// debugReason: this is the direct response to "we can't tell what's
// actually failing on Android without guessing again" — every fallback
// path now carries a concrete, specific reason string (not just a
// console.error that requires a debugger/logcat to ever see) and this
// renders a tappable "Why no map?" action that shows it in a plain
// appAlert, reachable on a real device with zero tooling. Kept separate
// from "Open in Maps" (which stays the primary action) rather than
// merging them, since a user who just wants to open the location
// shouldn't be interrupted by diagnostic text.
function PlainLocationBubble({
  lat,
  lng,
  isMe,
  a1,
  tokens,
  label,
  showOpenInMaps,
  debugReason,
}: {
  lat: number;
  lng: number;
  isMe: boolean;
  a1: string;
  tokens: any;
  label: string;
  showOpenInMaps?: boolean;
  debugReason?: string;
}) {
  const validCoords = Number.isFinite(lat) && Number.isFinite(lng);
  return (
    <View style={[{ borderRadius: 20, padding: 14, minWidth: 180 }, isMe ? { backgroundColor: a1 } : { backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder }]}>
      <Text style={{ fontFamily: fontFamilies.bold, color: isMe ? '#fff' : tokens.text, fontSize: 13.5 }}>📍 {label}</Text>
      <Text style={{ fontFamily: fontFamilies.medium, color: isMe ? 'rgba(255,255,255,0.85)' : tokens.text2, fontSize: 12, marginTop: 3 }}>
        {validCoords ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Coordinates unavailable'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
        {showOpenInMaps && validCoords && (
          <Pressable onPress={() => openInMaps(lat, lng)}>
            <Text style={{ fontFamily: fontFamilies.bold, fontSize: 12, color: isMe ? '#fff' : a1, textDecorationLine: 'underline' }}>Open in Maps</Text>
          </Pressable>
        )}
        {debugReason && (
          <Pressable onPress={() => appAlert('Why no map?', debugReason)}>
            <Text style={{ fontFamily: fontFamilies.medium, fontSize: 12, color: isMe ? 'rgba(255,255,255,0.75)' : tokens.text3, textDecorationLine: 'underline' }}>Why no map?</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Catches JS-level rendering errors from the location bubble (e.g.
 * malformed meta, a bad tile-math edge case) and falls back to plain text
 * instead of taking the whole message list down with it.
 *
 * This is NOT what fixed the real-device crash reported for this feature —
 * that crash was a native Java exception thrown from inside
 * react-native-maps' Android view construction (IllegalStateException from
 * Google Play Services' CreatorImpl, see the comment above MAPS), which
 * happens outside JS entirely and is not something a React error boundary
 * can intercept. What actually fixed it is that Android no longer renders
 * that native view at all. This boundary exists as ordinary defense in
 * depth for the JS-level map code, not as the crash fix itself.
 */
// fallback is a render-prop (error) => ReactNode, not a static node — a
// static fallback rendered before any error occurred has no way to show
// what the error actually WAS, which is exactly the "silently falling
// back to raw text" problem this whole round is about. Now the caught
// error's own message reaches the fallback UI's "Why no map?" action.
class LocationErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: (error: unknown) => React.ReactNode }, { hasError: boolean; error: unknown }> {
  constructor(props: { children: React.ReactNode; fallback: (error: unknown) => React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[LocationBubble] render error, falling back:', error);
  }
  render() {
    return this.state.hasError ? this.props.fallback(this.state.error) : this.props.children;
  }
}

/**
 * One-shot location share (see getCurrentLocationOnce in src/lib/media.ts —
 * there is no live/continuous tracking, this is a single point in time
 * captured once and sent like any other rich message).
 *
 * The actual map surface is LocationMapSurface, resolved per-platform by
 * Metro (.ios.tsx / .android.tsx / .web.tsx) — iOS keeps its existing
 * react-native-maps/MapKit implementation untouched (this app's current
 * phase is Android-focused; iOS already works and wasn't part of this
 * round's scope), Android and web both now render real interactive
 * OpenFreeMap vector tiles via MapLibre. This component only owns the
 * shell around that: preview vs. expanded-fullscreen layout, the "Open in
 * Maps" handoff, and the fallback/diagnostic UI when the map surface
 * itself fails.
 */
function LocationBubble({ meta, isMe, a1, tokens }: { meta: any; isMe: boolean; a1: string; tokens: any }) {
  const [expanded, setExpanded] = useState(false);
  const [loadFailedReason, setLoadFailedReason] = useState<string | null>(null);
  const lat = Number(meta.lat);
  const lng = Number(meta.lng);
  const { width: screenW, height: screenH } = useWindowDimensions();

  const crashFallback = (error: unknown) => (
    <PlainLocationBubble
      lat={lat}
      lng={lng}
      isMe={isMe}
      a1={a1}
      tokens={tokens}
      label="Location"
      showOpenInMaps
      debugReason={`Platform: ${Platform.OS}. The map view threw a JS error while rendering: ${error instanceof Error ? error.message : String(error)}`}
    />
  );
  const loadFailedFallback = (
    <PlainLocationBubble
      lat={lat}
      lng={lng}
      isMe={isMe}
      a1={a1}
      tokens={tokens}
      label="Location (map failed to load)"
      showOpenInMaps
      debugReason={`Platform: ${Platform.OS}. The OpenFreeMap map view reported a load failure: ${loadFailedReason ?? '(no detail)'}. No API key is used for this tile source, so this isn't a config problem — most likely a network issue, or tiles.openfreemap.org being unreachable/blocking this app's traffic (see LocationMapSurface.android.tsx's comment for the tile-provider history this app has already been through).`}
    />
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return <PlainLocationBubble lat={lat} lng={lng} isMe={isMe} a1={a1} tokens={tokens} label="Location unavailable" debugReason={`Platform: ${Platform.OS}. meta.lat/meta.lng did not parse as finite numbers (lat=${JSON.stringify(meta.lat)}, lng=${JSON.stringify(meta.lng)}).`} />;
  }

  if (loadFailedReason) {
    // eslint-disable-next-line no-console
    console.warn('[LocationBubble] map failed to load on', Platform.OS, '—', loadFailedReason);
    return loadFailedFallback;
  }

  return (
    <LocationErrorBoundary fallback={crashFallback}>
      <Pressable onPress={() => setExpanded(true)} style={{ borderRadius: 20, overflow: 'hidden', width: 220 }}>
        <LocationMapSurface lat={lat} lng={lng} width={220} height={140} interactive={false} onLoadFailed={setLoadFailedReason} />
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
          <LocationMapSurface lat={lat} lng={lng} width={screenW} height={screenH} interactive />
          <Pressable
            onPress={() => openInMaps(lat, lng)}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 46, borderRadius: 16, paddingVertical: 14, alignItems: 'center', backgroundColor: a1 }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontFamily: fontFamilies.bold }}>Open in Maps</Text>
          </Pressable>
          <Pressable
            onPress={() => setExpanded(false)}
            style={{ position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontFamily: fontFamilies.bold }}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </LocationErrorBoundary>
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

/**
 * Same defense-in-depth purpose as LocationErrorBoundary above — expo-video
 * is a new dependency this round with no real-device verification
 * available in this sandbox, so a native-surface error here falls back to
 * a plain message instead of taking the whole chat list down.
 */
class VideoErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[VideoMessageBubble] playback error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontFamily: fontFamilies.medium }}>Couldn't play this video.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function VideoPlayerModalInner({ onClose, base64, mime }: { onClose: () => void; base64: string; mime: string }) {
  const [uri, setUri] = useState<string | null>(null);
  // Distinct from "uri still null because staging hasn't finished yet" —
  // without this, a write failure (confirmed on web: expo-file-system's
  // writeAsStringAsync has no web implementation at all, throwing
  // "not available on web") left the modal spinning forever with no
  // indication anything had gone wrong.
  const [stageError, setStageError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ext = mime.includes('quicktime') ? 'mov' : 'mp4';
        const path = `${FileSystem.cacheDirectory}video-${Date.now()}.${ext}`;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (!cancelled) setUri(path);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[VideoMessageBubble] failed to stage video file:', e);
        if (!cancelled) setStageError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // base64/mime are effectively immutable for a given message — re-run
    // only if this modal instance is reused for a different message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64, mime]);

  // null source is valid — expo-video shows nothing/idle until replaced,
  // which is exactly the "still staging the file" state above.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    if (uri) p.play();
  });

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <VideoErrorBoundary>
          {uri ? (
            <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />
          ) : stageError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Text style={{ color: '#fff', fontFamily: fontFamilies.medium, textAlign: 'center' }}>Couldn't play this video.</Text>
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </VideoErrorBoundary>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontFamily: fontFamilies.bold }}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// Only mounted while the modal is open, so useVideoPlayer (a hook) never
// runs for videos the user hasn't tapped to play — same on-demand cost
// tradeoff already used for the location bubble's expanded map view.
function VideoPlayerModal({ visible, onClose, base64, mime }: { visible: boolean; onClose: () => void; base64: string; mime: string }) {
  if (!visible) return null;
  return <VideoPlayerModalInner onClose={onClose} base64={base64} mime={mime} />;
}

function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <Path d="M8 5v14l11-7-11-7Z" />
    </Svg>
  );
}

/**
 * Thumbnail + play button, never autoplaying inline — tapping opens a
 * fullscreen player (VideoPlayerModal). thumbnailBase64 can be null (see
 * pickVideoBase64's own try/catch around thumbnail generation), in which
 * case a plain film-strip placeholder is shown instead of leaving a
 * broken image.
 */
function VideoMessageBubble({ meta }: { meta: any }) {
  const [expanded, setExpanded] = useState(false);
  const thumb = meta.thumbnailBase64 ? `data:image/jpeg;base64,${meta.thumbnailBase64}` : null;
  return (
    <>
      <Pressable onPress={() => setExpanded(true)} style={{ borderRadius: 20, overflow: 'hidden', width: 220, height: 220 }}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: 220, height: 220 }} resizeMode="cover" />
        ) : (
          <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c1c22' }}>
            <PlayIcon size={30} />
          </View>
        )}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <PlayIcon />
          </View>
        </View>
        {meta.durationLabel && (
          <View style={{ position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color: '#fff', fontSize: 10.5, fontFamily: fontFamilies.semibold }}>{meta.durationLabel}</Text>
          </View>
        )}
      </Pressable>
      <VideoPlayerModal visible={expanded} onClose={() => setExpanded(false)} base64={String(meta.base64)} mime={String(meta.mime ?? 'video/mp4')} />
    </>
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
