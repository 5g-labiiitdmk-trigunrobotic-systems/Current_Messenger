import React, { useEffect, useRef, useState } from 'react';
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
import { useGroupStore } from '../../src/state/groupStore';
import { useContactStore } from '../../src/state/contactStore';
import { useAuthStore } from '../../src/state/authStore';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, a1, a2 } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.session?.user.id);
  const group = useGroupStore((s) => s.groups[id ?? '']);
  const approved = useContactStore((s) => s.approved);
  const threads = useChatStore((s) => s.threads);
  const { sendText, setTyping, react } = useChatStore();

  const key = getThreadKey(id ?? '', true);
  const messages = threads[key] ?? [];
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
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
    sendText(id ?? '', true, draft.trim());
    setDraft('');
    setTyping(id ?? '', true, false);
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
          </Glass>
        </Pressable>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 11 }}
          ListHeaderComponent={
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
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const showName = item.from !== me && (!prev || prev.from !== item.from);
            return (
              <MessageBubble message={item} isMe={item.from === me} senderName={showName ? nameFor(item.from) : undefined} onLongPress={() => react(id ?? '', true, item.id, '👍')} />
            );
          }}
        />

        {canPost ? (
          <Glass radius={0} bordered={false} style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: insets.bottom + 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Glass radius={23} style={{ flex: 1, height: 46, paddingHorizontal: 16, justifyContent: 'center' }} variant="field">
              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                placeholder={`Message ${group.name}…`}
                placeholderTextColor={tokens.text3}
                style={{ fontSize: 15, color: tokens.text, fontFamily: fontFamilies.regular }}
              />
            </Glass>
            <Pressable onPress={onSend}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: a1, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9}>
                  <Path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                </Svg>
              </View>
            </Pressable>
          </Glass>
        ) : (
          <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
            <Text style={{ textAlign: 'center', color: tokens.text3, fontFamily: fontFamilies.semibold, fontSize: 12.5 }}>Only the channel owner can post here.</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
