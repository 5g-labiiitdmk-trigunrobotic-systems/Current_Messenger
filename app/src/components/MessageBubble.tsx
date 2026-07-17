import React, { useState } from 'react';
import { View, Text, Image, Pressable, Modal, Platform, Linking, useWindowDimensions } from 'react-native';
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

// tile.openstreetmap.org is OSM's own free "main" tile server — no API key,
// no billing account, but it's explicitly meant for light/evaluation use
// (see https://operations.osmfoundation.org/policies/tiles/): it expects a
// real User-Agent, reasonable request volume, and no bulk/heavy production
// traffic without prior arrangement. Fine for this app's current scale;
// a high-traffic rollout should move to a paid OSM-tile provider (MapTiler,
// Thunderforest, Stadia, etc.) or a self-hosted tile server instead of
// hotlinking this one, to avoid risking an IP-based block.
const OSM_TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
// Required by the same tile usage policy above — any use of OSM's tiles
// must carry this credit near the map.
const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

// CORRECTED after a real-device crash (IllegalStateException: API key not
// found, thrown from com.rnmaps.maps.MapView.onCreate via Google Play
// Services' CreatorImpl.newMapViewDelegate): react-native-maps' Android
// native view is built entirely on top of com.google.android.gms.maps —
// there is no alternate Android backend in this library. `mapType="none"`
// only controls what tiles get drawn AFTER the underlying GoogleMap object
// finishes initializing; it does NOT skip that initialization, which
// unconditionally requires a com.google.android.geo.API_KEY manifest
// entry regardless of mapType/tile source. The previous round's "OSM tiles
// avoid needing a Google key" reasoning was wrong. Since this app has no
// Google Maps API key configured (that was the whole point of switching to
// OSM), rendering react-native-maps' <MapView> on Android is a guaranteed
// crash — so it is never rendered there anymore. Android now renders a
// plain <Image>-based static tile mosaic (buildOsmTileLayout below) instead
// — genuinely independent of Google's native map engine, since it never
// constructs a native map view at all, just fetches OSM raster tiles over
// HTTP like any other image. This trades away pinch/zoom/pan (a static
// snapshot only) for a bought-and-paid-for guarantee that it cannot repeat
// this crash; "Open in Maps" in the expanded view hands off to the device's
// own maps app for real interactive navigation. iOS is untouched — its
// react-native-maps backend is Apple MapKit (confirmed via the plugin
// source: it only links Google Maps when iosGoogleMapsApiKey is set, which
// this app never sets), which needs no API key and was never at risk.
//
// A real native OSM-tile map view (e.g. MapLibre, which has no Google
// dependency at all and would restore full interactivity on Android) is a
// reasonable future upgrade, but is deliberately NOT what's shipped here:
// it would mean introducing another brand-new native module whose on-device
// behavior this sandbox cannot fully verify either — exactly the class of
// mistake that caused this crash. The static-image approach below is
// verifiable end-to-end without a native build (it's pure JS + network
// image fetches), so it ships now; MapLibre is worth evaluating later with
// real-device testing before it replaces this.
const MAPS = Platform.OS === 'ios' ? require('react-native-maps') : null;
const MapView: any = MAPS?.default;
const Marker: any = MAPS?.Marker;

const OSM_TILE_SIZE = 256;

// Standard Web Mercator projection: lat/lng -> fractional tile coordinates
// at a given zoom. See https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function projectToTile(lat: number, lng: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/**
 * Computes which OSM raster tiles are needed to cover a width x height
 * viewport centered on (lat, lng), and each tile's pixel offset within that
 * viewport. Centering this way means the target point always lands at
 * exactly (width/2, height/2) in the returned container — the pin overlay
 * never needs its own position math.
 */
function buildOsmTileLayout(lat: number, lng: number, zoom: number, width: number, height: number) {
  const { x, y } = projectToTile(lat, lng, zoom);
  const centerPxX = x * OSM_TILE_SIZE;
  const centerPxY = y * OSM_TILE_SIZE;
  const originPxX = centerPxX - width / 2;
  const originPxY = centerPxY - height / 2;
  const tileX0 = Math.floor(originPxX / OSM_TILE_SIZE);
  const tileY0 = Math.floor(originPxY / OSM_TILE_SIZE);
  const tilesWide = Math.ceil((originPxX + width) / OSM_TILE_SIZE) - tileX0 + 1;
  const tilesHigh = Math.ceil((originPxY + height) / OSM_TILE_SIZE) - tileY0 + 1;
  const maxTileIndex = Math.pow(2, zoom) - 1;

  const tiles: { key: string; left: number; top: number; url: string }[] = [];
  for (let ty = 0; ty < tilesHigh; ty++) {
    for (let tx = 0; tx < tilesWide; tx++) {
      const tileX = tileX0 + tx;
      const tileY = tileY0 + ty;
      if (tileX < 0 || tileY < 0 || tileX > maxTileIndex || tileY > maxTileIndex) continue;
      tiles.push({
        key: `${tileX}-${tileY}`,
        left: tileX * OSM_TILE_SIZE - originPxX,
        top: tileY * OSM_TILE_SIZE - originPxY,
        url: OSM_TILE_URL_TEMPLATE.replace('{z}', String(zoom)).replace('{x}', String(tileX)).replace('{y}', String(tileY)),
      });
    }
  }
  return tiles;
}

function PinIcon({ size = 30, color = '#ff4d4f' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Z" fill={color} />
      <Path d="M12 7a3 3 0 110 6 3 3 0 010-6Z" fill="#fff" />
    </Svg>
  );
}

/**
 * Non-interactive static map for Android — see the MAPS/MapView comment
 * above for why Android never renders react-native-maps' native view.
 */
function OsmStaticMap({ lat, lng, width, height, zoom }: { lat: number; lng: number; width: number; height: number; zoom: number }) {
  const tiles = buildOsmTileLayout(lat, lng, zoom, width, height);
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#dfe3e8' }}>
      {tiles.map((t) => (
        <Image key={t.key} source={{ uri: t.url }} style={{ position: 'absolute', left: t.left, top: t.top, width: OSM_TILE_SIZE, height: OSM_TILE_SIZE }} />
      ))}
      <View style={{ position: 'absolute', left: width / 2 - 15, top: height / 2 - 30 }}>
        <PinIcon />
      </View>
      <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
        <Text style={{ fontSize: 8, color: '#333' }}>{OSM_ATTRIBUTION}</Text>
      </View>
    </View>
  );
}

function openInMaps(lat: number, lng: number) {
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?ll=${lat},${lng}&q=Shared+location` : `geo:${lat},${lng}?q=${lat},${lng}(Shared+location)`;
  Linking.canOpenURL(url).then((can) => {
    if (can) Linking.openURL(url);
    else Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`);
  });
}

function PlainLocationBubble({ lat, lng, isMe, a1, tokens, label }: { lat: number; lng: number; isMe: boolean; a1: string; tokens: any; label: string }) {
  return (
    <View style={[{ borderRadius: 20, padding: 14, minWidth: 180 }, isMe ? { backgroundColor: a1 } : { backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder }]}>
      <Text style={{ fontFamily: fontFamilies.bold, color: isMe ? '#fff' : tokens.text, fontSize: 13.5 }}>📍 {label}</Text>
      <Text style={{ fontFamily: fontFamilies.medium, color: isMe ? 'rgba(255,255,255,0.85)' : tokens.text2, fontSize: 12, marginTop: 3 }}>
        {Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Coordinates unavailable'}
      </Text>
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
class LocationErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[LocationBubble] render error, falling back:', error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/**
 * One-shot location share (see getCurrentLocationOnce in src/lib/media.ts —
 * there is no live/continuous tracking, this is a single point in time
 * captured once and sent like any other rich message).
 *
 * iOS: real interactive react-native-maps MapView (Apple MapKit backend,
 * no API key needed, unaffected by the Android crash below).
 * Android: a non-interactive static OSM tile mosaic (see OsmStaticMap) in
 * both the bubble preview and the expanded view, plus an "Open in Maps"
 * button in the expanded view for real pan/zoom/navigation via the
 * device's own maps app.
 * Web: plain coordinate text (react-native-maps has no web backend at all,
 * see the MAPS comment above the OSM_TILE_URL_TEMPLATE for why the module
 * import itself is guarded).
 */
function LocationBubble({ meta, isMe, a1, tokens }: { meta: any; isMe: boolean; a1: string; tokens: any }) {
  const [expanded, setExpanded] = useState(false);
  const lat = Number(meta.lat);
  const lng = Number(meta.lng);
  const { width: screenW, height: screenH } = useWindowDimensions();

  const fallback = <PlainLocationBubble lat={lat} lng={lng} isMe={isMe} a1={a1} tokens={tokens} label="Location" />;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return <PlainLocationBubble lat={lat} lng={lng} isMe={isMe} a1={a1} tokens={tokens} label="Location unavailable" />;
  }

  if (Platform.OS === 'web') return fallback;

  if (Platform.OS === 'android') {
    return (
      <LocationErrorBoundary fallback={fallback}>
        <Pressable onPress={() => setExpanded(true)} style={{ borderRadius: 20, overflow: 'hidden', width: 220 }}>
          <OsmStaticMap lat={lat} lng={lng} width={220} height={140} zoom={16} />
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
            <OsmStaticMap lat={lat} lng={lng} width={screenW} height={screenH} zoom={16} />
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

  // iOS
  const region = { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  return (
    <LocationErrorBoundary fallback={fallback}>
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
