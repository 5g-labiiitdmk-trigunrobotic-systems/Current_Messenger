import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Glass } from '../../src/components/Glass';
import { Avatar } from '../../src/components/Avatar';
import { MessageBubble } from '../../src/components/MessageBubble';
import { TypingDots } from '../../src/components/TypingDots';
import { BokehBackground } from '../../src/components/BokehBackground';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useChatStore, getThreadKey } from '../../src/state/chatStore';
import { useContactStore } from '../../src/state/contactStore';
import { usePresenceStore } from '../../src/state/presenceStore';
import { useCallStore } from '../../src/state/callStore';
import { useAuthStore } from '../../src/state/authStore';
import { isPresenceVisible } from '../../src/lib/presencePolicy';
import { pickImageBase64, getCurrentLocationOnce, startVoiceRecording, stopVoiceRecording, playAudioBase64 } from '../../src/lib/media';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, a1 } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.session?.user.id);
  const contact = useContactStore((s) => s.approved.find((c) => c.id === id));
  const presence = usePresenceStore((s) => s.byUser[id ?? '']);
  const threads = useChatStore((s) => s.threads);
  const typingMap = useChatStore((s) => s.typing);
  const { sendText, sendRich, forwardMessage, setTyping, markRead, react, editMessage, deleteLocal, togglePin, votePoll, pinned } = useChatStore();
  const ring = useCallStore((s) => s.ring);
  const approved = useContactStore((s) => s.approved);

  const key = getThreadKey(id ?? '', false);
  const allMessages = threads[key] ?? [];
  const isTyping = !!typingMap[key];
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptA, setPollOptA] = useState('');
  const [pollOptB, setPollOptB] = useState('');
  const listRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const messages = searchQuery.trim() ? allMessages.filter((m) => m.text?.toLowerCase().includes(searchQuery.trim().toLowerCase())) : allMessages;

  useEffect(() => {
    const last = allMessages[allMessages.length - 1];
    if (last && last.from !== me && last.status !== 'read') markRead(id ?? '', false, last.id);
    if (!searchQuery) listRef.current?.scrollToEnd({ animated: true });
  }, [allMessages.length]);

  const onChangeDraft = (t: string) => {
    setDraft(t);
    setTyping(id ?? '', false, true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTyping(id ?? '', false, false), 1500);
  };

  const onSend = () => {
    if (!draft.trim()) return;
    if (editingId) {
      editMessage(id ?? '', false, editingId, draft.trim());
      setEditingId(null);
    } else {
      sendText(id ?? '', false, draft.trim(), { replyToId: replyTo ?? undefined });
    }
    setDraft('');
    setReplyTo(null);
    setTyping(id ?? '', false, false);
  };

  const onMic = async () => {
    if (!recording) {
      const ok = await startVoiceRecording(recorder);
      if (!ok) {
        Alert.alert('Microphone permission needed', 'Enable microphone access to send voice messages.');
        return;
      }
      setRecording(true);
    } else {
      setRecording(false);
      const result = await stopVoiceRecording(recorder);
      if (result) sendRich(id ?? '', false, 'voice', result);
    }
  };

  const onAttach = async () => {
    Alert.alert('Share', undefined, [
      {
        text: 'Photo',
        onPress: async () => {
          const img = await pickImageBase64();
          if (img) sendRich(id ?? '', false, 'media', img);
        },
      },
      {
        text: 'Live location',
        onPress: async () => {
          const loc = await getCurrentLocationOnce();
          if (loc) sendRich(id ?? '', false, 'location', loc);
          else Alert.alert('Location permission needed', 'Enable location access to share your position.');
        },
      },
      { text: 'Sticker', onPress: onPickSticker },
      { text: 'Poll', onPress: () => setPollOpen(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onPickSticker = () => {
    const stickers = ['😀', '😂', '❤️', '🔥', '👍', '🎉', '🙌', '😢'];
    Alert.alert(
      'Send a sticker',
      undefined,
      stickers.map((emoji) => ({ text: emoji, onPress: () => sendRich(id ?? '', false, 'sticker', { emoji }) })).concat([{ text: 'Cancel', style: 'cancel' } as any])
    );
  };

  const onSendPoll = () => {
    if (!pollQuestion.trim() || !pollOptA.trim() || !pollOptB.trim()) {
      Alert.alert('Fill in the poll', 'A question and both options are required.');
      return;
    }
    sendRich(id ?? '', false, 'poll', { question: pollQuestion.trim(), options: [pollOptA.trim(), pollOptB.trim()], votes: {} });
    setPollOpen(false);
    setPollQuestion('');
    setPollOptA('');
    setPollOptB('');
  };

  const onForward = (message: (typeof messages)[number]) => {
    if (approved.length === 0) {
      Alert.alert('No contacts', 'Add a contact to forward messages to.');
      return;
    }
    Alert.alert(
      'Forward to',
      undefined,
      approved
        .slice(0, 6)
        .map((c) => ({ text: c.display_name || c.username, onPress: () => forwardMessage(message, c.id, false) }))
        .concat([{ text: 'Cancel', style: 'cancel' } as any])
    );
  };

  const onLongPressMessage = (messageId: string, isMine: boolean, text?: string) => {
    const message = allMessages.find((m) => m.id === messageId);
    const options: any[] = [
      { text: '👍 React', onPress: () => react(id ?? '', false, messageId, '👍') },
      { text: '❤️ React', onPress: () => react(id ?? '', false, messageId, '❤️') },
      { text: 'Reply', onPress: () => setReplyTo(messageId) },
      { text: 'Forward', onPress: () => message && onForward(message) },
      { text: pinned[key]?.includes(messageId) ? 'Unpin' : 'Pin', onPress: () => togglePin(id ?? '', false, messageId) },
    ];
    if (isMine && text) {
      options.push({
        text: 'Edit',
        onPress: () => {
          setDraft(text);
          setEditingId(messageId);
        },
      });
    }
    options.push({ text: 'Delete for me', style: 'destructive', onPress: () => deleteLocal(id ?? '', false, messageId) });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message', undefined, options);
  };

  if (!contact) {
    return (
      <View style={{ flex: 1 }}>
        <BokehBackground />
        <Text style={{ marginTop: 100, textAlign: 'center', color: tokens.text }}>Contact not found.</Text>
      </View>
    );
  }

  const presenceVisible = isPresenceVisible(contact);
  const isOnline = presenceVisible && presence?.status === 'online';
  const statusLabel = !presenceVisible
    ? ''
    : isOnline
      ? 'online now'
      : presence?.lastSeenAt
        ? `last seen ${new Date(presence.lastSeenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'offline';

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Glass radius={0} bordered={false} style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Pressable onPress={() => router.back()} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18l-6-6 6-6" />
            </Svg>
          </Pressable>
          <Avatar hue={contact.avatar_hue} size={42} online={isOnline} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontFamily: fontFamilies.heavy, color: tokens.text }}>{contact.display_name || contact.username}</Text>
            <Text style={{ fontSize: 12, fontFamily: fontFamilies.semibold, color: isOnline ? '#34d27b' : tokens.text2 }}>{statusLabel}</Text>
          </View>
          <Pressable onPress={() => ring(contact.id, 'voice')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={1.9}>
              <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
            </Svg>
          </Pressable>
          <Pressable onPress={() => ring(contact.id, 'video')} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={1.9}>
              <Path d="M23 7l-7 5 7 5V7Z" />
              <Path d="M1 5h15v14H1z" />
            </Svg>
          </Pressable>
          <Pressable onPress={() => setSearchOpen((o) => !o)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={searchOpen ? a1 : tokens.text} strokeWidth={2}>
              <Path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
              <Path d="M21 21l-4.3-4.3" />
            </Svg>
          </Pressable>
        </Glass>

        {searchOpen && (
          <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
            <Glass radius={16} style={{ paddingHorizontal: 14, paddingVertical: 9 }} variant="field">
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search this session's messages…"
                placeholderTextColor={tokens.text3}
                style={{ fontSize: 14, color: tokens.text, fontFamily: fontFamilies.regular }}
                autoFocus
              />
            </Glass>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 11 }}
          ListHeaderComponent={
            <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <Glass radius={14} style={{ paddingVertical: 7, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={2.2}>
                  <Path d="M4 11h16v10H4z" />
                  <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </Svg>
                <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Messages are end-to-end encrypted — nothing is stored</Text>
              </Glass>
            </View>
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMe={item.from === me}
              meId={me}
              onLongPress={() => onLongPressMessage(item.id, item.from === me, item.text)}
              onVote={(optionIndex) => votePoll(id ?? '', false, item.id, optionIndex)}
            />
          )}
          ListFooterComponent={
            isTyping ? (
              <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <Glass radius={20} style={{ paddingVertical: 14, paddingHorizontal: 17 }}>
                  <TypingDots color={tokens.text2} />
                </Glass>
              </View>
            ) : null
          }
        />

        {pollOpen && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
            <Glass radius={20} style={{ padding: 14, gap: 8 }} variant="bg2">
              <Text style={{ fontSize: 12, fontFamily: fontFamilies.bold, color: tokens.text2 }}>New poll — live for this session only</Text>
              <TextInput value={pollQuestion} onChangeText={setPollQuestion} placeholder="Question" placeholderTextColor={tokens.text3} style={{ fontSize: 14.5, color: tokens.text, fontFamily: fontFamilies.semibold, paddingVertical: 6 }} />
              <TextInput value={pollOptA} onChangeText={setPollOptA} placeholder="Option A" placeholderTextColor={tokens.text3} style={{ fontSize: 14, color: tokens.text, fontFamily: fontFamilies.regular, paddingVertical: 6 }} />
              <TextInput value={pollOptB} onChangeText={setPollOptB} placeholder="Option B" placeholderTextColor={tokens.text3} style={{ fontSize: 14, color: tokens.text, fontFamily: fontFamilies.regular, paddingVertical: 6 }} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Pressable onPress={() => setPollOpen(false)} style={{ flex: 1 }}>
                  <View style={{ height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.field }}>
                    <Text style={{ color: tokens.text2, fontFamily: fontFamilies.bold, fontSize: 13 }}>Cancel</Text>
                  </View>
                </Pressable>
                <Pressable onPress={onSendPoll} style={{ flex: 1 }}>
                  <View style={{ height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: a1 }}>
                    <Text style={{ color: '#fff', fontFamily: fontFamilies.bold, fontSize: 13 }}>Send poll</Text>
                  </View>
                </Pressable>
              </View>
            </Glass>
          </View>
        )}

        {(replyTo || editingId) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6, gap: 8 }}>
            <Text style={{ fontSize: 12, color: tokens.text2, fontFamily: fontFamilies.medium, flex: 1 }}>{editingId ? 'Editing message' : 'Replying to a message'}</Text>
            <Pressable
              onPress={() => {
                setReplyTo(null);
                setEditingId(null);
                setDraft('');
              }}
            >
              <Text style={{ color: a1, fontFamily: fontFamilies.bold, fontSize: 12 }}>Cancel</Text>
            </Pressable>
          </View>
        )}

        <Glass radius={0} bordered={false} style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: insets.bottom + 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
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
              placeholder={recording ? 'Recording…' : 'Message…'}
              placeholderTextColor={tokens.text3}
              editable={!recording}
              style={{ fontSize: 15, color: tokens.text, fontFamily: fontFamilies.regular }}
            />
          </Glass>
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
        </Glass>
      </KeyboardAvoidingView>
    </View>
  );
}
