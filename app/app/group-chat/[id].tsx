import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { Glass } from '../../src/components/Glass';
import { MessageBubble } from '../../src/components/MessageBubble';
import { BokehBackground } from '../../src/components/BokehBackground';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useChatStore, getThreadKey } from '../../src/state/chatStore';
import type { ChatMessage } from '../../src/state/chatStore';
import { withDateSeparators } from '../../src/lib/dateSeparators';
import { useGroupStore } from '../../src/state/groupStore';
import { useGroupCallStore, GROUP_CALL_CAP } from '../../src/state/groupCallStore';
import { useContactStore } from '../../src/state/contactStore';
import { useAuthStore } from '../../src/state/authStore';
import { previewFor } from '../../src/data/conversations';
import { appAlert } from '../../src/state/alertStore';
import { pickImageBase64, pickVideoBase64, startVoiceRecording, stopVoiceRecording, MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_FILE_BYTES } from '../../src/lib/media';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, a1, a2 } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.session?.user.id);
  const group = useGroupStore((s) => s.groups[id ?? '']);
  const approved = useContactStore((s) => s.approved);
  const threads = useChatStore((s) => s.threads);
  const { sendText, sendRich, setTyping, react, markRead } = useChatStore();
  const startGroupCall = useGroupCallStore((s) => s.startGroupCall);
  const groupCallPhase = useGroupCallStore((s) => s.phase);

  const key = getThreadKey(id ?? '', true);
  const messages = threads[key] ?? [];
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Same recorder ownership pattern as chat/[id].tsx — AudioRecorder
  // instances can only be created via this hook, so the component owns
  // it and passes it into media.ts's start/stopVoiceRecording.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Same reply feature as chat/[id].tsx's 1:1 screen, applied here — the
  // composer's reply banner and each sent bubble's quoted-reply strip both
  // need the actual replied-to message, not just its id.
  const replyToMessage = replyTo ? messages.find((m) => m.id === replyTo) : null;

  // FlatList below is rendered `inverted` — see the detailed comment in
  // app/chat/[id].tsx for the full four-round history of the keyboard-open
  // gap bug this solves structurally instead of via scroll-timing patches,
  // and for why renderItem/ListFooterComponent below need no manual
  // counter-transform (verified live: RN's `inverted` already renders
  // content right-side up on its own).
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const rowsWithSeparators = useMemo(() => withDateSeparators(invertedMessages), [invertedMessages]);
  // Inserting date-separator rows shifts every message's position within
  // the FlatList's own `data` array, so the existing "chronologically
  // preceding message" lookup below can no longer use `index + 1` into
  // that array (see renderItem) — this maps each message id straight to
  // its predecessor in the separator-free, newest-first order instead,
  // immune to how many separators end up between them on screen.
  const chronoPrevByMessageId = useMemo(() => {
    const map = new Map<string, ChatMessage | undefined>();
    invertedMessages.forEach((m, i) => map.set(m.id, invertedMessages[i + 1]));
    return map;
  }, [invertedMessages]);

  useEffect(() => {
    // Was entirely missing here — unlike chat/[id].tsx's DM screen, this
    // screen never called markRead() at all, so a group's unread count
    // never cleared no matter how long it was open.
    const last = messages[messages.length - 1];
    if (last && last.from !== me && last.status !== 'read') markRead(id ?? '', true, last.id);
  }, [messages.length]);

  const nameFor = (uid: string) => {
    if (uid === me) return 'You';
    return approved.find((c) => c.id === uid)?.display_name ?? approved.find((c) => c.id === uid)?.username ?? 'Member';
  };

  const canPost = !group?.isBroadcast || group?.ownerId === me;

  const onChangeDraft = (t: string) => {
    setDraft(t);
    setTyping(id ?? '', true, true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTyping(id ?? '', true, false), 1500);
  };

  const onSend = () => {
    if (!draft.trim()) return;
    sendText(id ?? '', true, draft.trim(), { replyToId: replyTo ?? undefined });
    setDraft('');
    setReplyTo(null);
    setTyping(id ?? '', true, false);
  };

  // Directly reuses chat/[id].tsx's own onMic — same media.ts functions,
  // same error handling (the 3-way start result and the "Recording
  // failed" fallback are both from that recent reliability fix, carried
  // over unchanged here rather than reimplemented). The only difference
  // from the 1:1 version is `true` for isGroup on sendRich, which routes
  // through sendRich's existing group branch (encryptForGroupMembers —
  // already-working pairwise fan-out encryption, the same mechanism
  // group text/replies already use), not the 1:1 single-recipient path.
  const onMic = async () => {
    if (!recording) {
      const result = await startVoiceRecording(recorder);
      if (result === 'permission_denied') {
        appAlert('Microphone permission needed', 'Enable microphone access to send voice messages.');
        return;
      }
      if (result === 'start_failed') {
        appAlert('Could not start recording', 'Something went wrong starting the microphone — try again in a moment.');
        return;
      }
      setRecording(true);
    } else {
      setRecording(false);
      const result = await stopVoiceRecording(recorder);
      if (result) sendRich(id ?? '', true, 'voice', result);
      else appAlert('Recording failed', "Your voice message couldn't be saved — try recording again.");
    }
  };

  // Directly reuses chat/[id].tsx's photo path (pickImageBase64 handles
  // permission + picker + compression) — not the rest of its "Share"
  // menu (Location/Sticker/Poll), which wasn't asked for and doesn't
  // exist in group chat. No intermediate menu since there's only one
  // option here — tapping attach opens the picker directly.
  const onAttach = async () => {
    appAlert('Share', undefined, [
      {
        text: 'Camera',
        onPress: () => {
          // Same nested-menu shape as chat/[id].tsx's identical addition —
          // both branches share pickImageBase64/pickVideoBase64 with the
          // rest of this menu, only the capture source differs ('camera'
          // vs the default 'library'); see media.ts.
          appAlert('Camera', undefined, [
            {
              text: 'Take Photo',
              onPress: async () => {
                const img = await pickImageBase64('camera');
                if (img) sendRich(id ?? '', true, 'media', img);
              },
            },
            {
              text: 'Record Video',
              onPress: async () => {
                const result = await pickVideoBase64('camera');
                if (result.ok) {
                  sendRich(id ?? '', true, 'media', { base64: result.base64, mime: result.mime, mediaType: 'video', durationLabel: result.durationLabel, thumbnailBase64: result.thumbnailBase64 });
                } else if (result.reason === 'permission_denied') {
                  appAlert('Camera permission needed', 'Enable camera access to record a video.');
                } else if (result.reason === 'too_long') {
                  appAlert('Video too long', `Shared videos are limited to ${MAX_VIDEO_DURATION_SECONDS} seconds.`);
                } else if (result.reason === 'too_large') {
                  appAlert('Video too large', `This video is still over ${Math.round(MAX_VIDEO_FILE_BYTES / (1024 * 1024))}MB even after compression — try trimming it shorter.`);
                } else if (result.reason === 'failed') {
                  appAlert('Could not record this video', 'Something went wrong saving that recording — try again.');
                }
                // 'canceled': user backed out of the camera, nothing to show.
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]);
        },
      },
      {
        text: 'Photo',
        onPress: async () => {
          const img = await pickImageBase64();
          if (img) sendRich(id ?? '', true, 'media', img);
        },
      },
      {
        text: 'Video',
        onPress: async () => {
          const result = await pickVideoBase64();
          if (result.ok) {
            sendRich(id ?? '', true, 'media', { base64: result.base64, mime: result.mime, mediaType: 'video', durationLabel: result.durationLabel, thumbnailBase64: result.thumbnailBase64 });
          } else if (result.reason === 'permission_denied') {
            appAlert('Photo library permission needed', 'Enable access to your photo library to share a video.');
          } else if (result.reason === 'too_long') {
            appAlert('Video too long', `Shared videos are limited to ${MAX_VIDEO_DURATION_SECONDS} seconds.`);
          } else if (result.reason === 'too_large') {
            appAlert('Video too large', `This video is still over ${Math.round(MAX_VIDEO_FILE_BYTES / (1024 * 1024))}MB even after compression — try trimming it shorter.`);
          } else if (result.reason === 'failed') {
            appAlert('Could not share this video', 'Something went wrong reading that video — try a different one.');
          }
          // 'canceled': user backed out of the picker, nothing to show.
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // See docs/GROUP_CALLING.md and src/state/groupCallStore.ts — mesh
  // calling hard-capped at GROUP_CALL_CAP participants. startGroupCall()
  // itself already only rings the first (GROUP_CALL_CAP - 1) other
  // members; this just sets expectations up front for a group bigger than
  // that, rather than silently leaving some members out with no
  // explanation.
  const onStartGroupCall = (kind: 'voice' | 'video') => {
    if (groupCallPhase !== 'idle') return; // already on a group call
    const others = group.memberIds.filter((mid) => mid !== me);
    if (others.length === 0) return;
    const capped = others.length > GROUP_CALL_CAP - 1;
    if (capped) {
      appAlert(
        'Group calls are limited to 4 people',
        `This group has ${others.length + 1} members — only the first ${GROUP_CALL_CAP - 1} will be rung for this call.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call anyway', onPress: () => startGroupCall(id ?? '', kind) },
        ]
      );
    } else {
      startGroupCall(id ?? '', kind);
    }
  };

  const onLongPressMessage = (messageId: string) => {
    appAlert('Message', undefined, [
      { text: '👍 React', onPress: () => react(id ?? '', true, messageId, '👍') },
      { text: '❤️ React', onPress: () => react(id ?? '', true, messageId, '❤️') },
      { text: 'Reply', onPress: () => setReplyTo(messageId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!group) {
    return (
      <View style={{ flex: 1 }}>
        <BokehBackground />
        <Text style={{ marginTop: 100, textAlign: 'center', color: tokens.text }}>
          This group only exists while its members' sessions are active — it may have ended.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      {/* Same reasoning and evidence as the identical change in
          chat/[id].tsx — see that file's comment above its own
          KeyboardAvoidingView for the full explanation (both adjustResize
          and adjustPan actively fight KeyboardAvoidingView's own 'height'
          measurement, in different directions; fixed via
          plugins/withAdjustNothingSoftInput.js setting
          windowSoftInputMode="adjustNothing" so 'height' is the sole
          source of compensation). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable onPress={() => router.push(`/group-info/${id}`)}>
          <Glass radius={0} bordered={false} style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M15 18l-6-6 6-6" />
              </Svg>
            </Pressable>
            <LinearGradient colors={[a1, a2]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
                <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <Circle cx={9} cy={7} r={4} />
              </Svg>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontFamily: fontFamilies.heavy, color: tokens.text }}>
                {group.name}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: fontFamilies.medium, color: tokens.text2 }}>
                {group.memberIds.length} members{group.isBroadcast ? ' · broadcast' : ''}
              </Text>
            </View>
            {/* Nested Pressables inside the header's own Pressable (which
                navigates to group-info) — RN gives the innermost Pressable
                the touch, same as the back-arrow above, so tapping these
                doesn't also trigger that navigation. See
                docs/GROUP_CALLING.md / groupCallStore.ts. */}
            <Pressable onPress={() => onStartGroupCall('voice')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={1.9}>
                <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
              </Svg>
            </Pressable>
            <Pressable onPress={() => onStartGroupCall('video')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={1.9}>
                <Path d="M23 7l-7 5 7 5V7Z" />
                <Path d="M1 5h15v14H1z" />
              </Svg>
            </Pressable>
          </Glass>
        </Pressable>

        <FlatList
          ref={listRef}
          inverted
          data={rowsWithSeparators}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 11 }}
          // Was ListHeaderComponent (visual top) before inverting — with
          // `inverted`, RN renders header/footer cells at opposite visual
          // ends from normal, so this has to become ListFooterComponent to
          // stay visually at the top of the conversation. NOT wrapped in
          // any counter-transform — see the invertedMessages comment above
          // and the matching one in app/chat/[id].tsx: RN's `inverted`
          // already renders content right-side up on its own.
          ListFooterComponent={
            <View style={{ alignSelf: 'center', marginBottom: 6 }}>
              <Glass radius={14} style={{ paddingVertical: 7, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={2.2}>
                  <Path d="M4 11h16v10H4z" />
                  <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </Svg>
                <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>End-to-end encrypted group — nothing stored</Text>
              </Glass>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === 'date-separator') {
              return (
                <View style={{ alignSelf: 'center', marginVertical: 4 }}>
                  <Glass radius={12} style={{ paddingHorizontal: 12, paddingVertical: 5 }} variant="bg2">
                    <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.bold, color: tokens.text2 }}>{item.label}</Text>
                  </Glass>
                </View>
              );
            }
            // chronologically-PRECEDING message (used to decide whether to
            // show the sender's name above this bubble) — see
            // chronoPrevByMessageId's comment for why this is no longer an
            // index lookup.
            const chronoPrev = chronoPrevByMessageId.get(item.id);
            const showName = item.from !== me && (!chronoPrev || chronoPrev.from !== item.from);
            const repliedTo = item.replyToId ? messages.find((m) => m.id === item.replyToId) : null;
            return (
              <MessageBubble
                message={item}
                isMe={item.from === me}
                senderName={showName ? nameFor(item.from) : undefined}
                onLongPress={() => onLongPressMessage(item.id)}
                replyPreview={repliedTo ? { senderLabel: nameFor(repliedTo.from), text: previewFor(repliedTo) } : null}
              />
            );
          }}
        />

        {replyTo && replyToMessage && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6, gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', gap: 8, borderLeftWidth: 3, borderLeftColor: a1, paddingLeft: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.bold, color: a1 }}>{nameFor(replyToMessage.from)}</Text>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, color: tokens.text2, fontFamily: fontFamilies.medium }}>
                  {previewFor(replyToMessage)}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Text style={{ color: a1, fontFamily: fontFamilies.bold, fontSize: 12 }}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {canPost ? (
          // Third direction change on this row's outer wrapper tonight —
          // noted explicitly, not a bug fix: reverted from a bounded
          // card+border back to transparent/floating (matching
          // chat/[id].tsx's identical reversal) per explicit re-request.
          // Plain View, no background/border of its own.
          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 10,
              // Android runs edge-to-edge — the system nav bar overlays
              // content rather than reserving space, so a flat
              // paddingBottom left this composer's bottom edge sitting
              // partially behind it on gesture-nav devices. Same fix as
              // chat/[id].tsx's identical composer wrapper; see that
              // file's comment for the fuller edge-to-edge reasoning.
              paddingBottom: 12 + insets.bottom,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
            }}
          >
            {/* Photo attach — directly reuses chat/[id].tsx's pickImageBase64
                + sendRich pipeline, wired to the group branch (isGroup=true)
                instead of duplicating the picker/compression/encryption
                logic. */}
            <Pressable onPress={onAttach} style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
              <Glass radius={21} style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text2} strokeWidth={2} strokeLinecap="round">
                  <Path d="M12 5v14M5 12h14" />
                </Svg>
              </Glass>
            </Pressable>
            <Glass radius={23} style={{ flex: 1, height: 46, paddingHorizontal: 16, justifyContent: 'center' }} variant="field">
              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                placeholder={recording ? 'Recording…' : `Message ${group.name}…`}
                placeholderTextColor={tokens.text3}
                editable={!recording}
                style={{ fontSize: 15, color: tokens.text, fontFamily: fontFamilies.regular }}
              />
            </Glass>
            {/* Send/mic toggle — now genuinely wired to voice recording
                (see onMic above), matching chat/[id].tsx's composer
                exactly, including the recording-in-progress red tint. */}
            <Pressable onPress={draft.trim() ? onSend : onMic}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: recording ? '#ff5a6e' : a1, alignItems: 'center', justifyContent: 'center' }}>
                {draft.trim() ? (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7Z" />
                  </Svg>
                ) : (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9}>
                    <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                  </Svg>
                )}
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
            <Text style={{ textAlign: 'center', color: tokens.text3, fontFamily: fontFamilies.semibold, fontSize: 12.5 }}>Only the channel owner can post here.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
