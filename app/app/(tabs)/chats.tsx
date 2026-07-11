import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { ScreenTitle } from '../../src/components/Typography';
import { Glass } from '../../src/components/Glass';
import { Avatar } from '../../src/components/Avatar';
import { IconCircle } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useConversationRows } from '../../src/data/conversations';
import { useContactStore } from '../../src/state/contactStore';

const FILTERS = ['All', 'Unread', 'Groups', 'Channels'] as const;

export default function ChatsScreen() {
  const { tokens, a1, a2, toggleMode, mode } = useTheme();
  const rows = useConversationRows();
  const approved = useContactStore((s) => s.approved);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const filtered = rows.filter((r) => {
    if (filter === 'Unread') return r.unread > 0;
    if (filter === 'Groups') return r.isGroup && !r.isBroadcast;
    if (filter === 'Channels') return r.isBroadcast;
    return true;
  });

  return (
    <ScreenScaffold tabBar>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle>Chats</ScreenTitle>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconCircle onPress={toggleMode}>
            {mode === 'light' ? (
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </Svg>
            ) : (
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={4} />
                <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </Svg>
            )}
          </IconCircle>
          <IconCircle variant="accent" onPress={() => router.push('/(tabs)/contacts')}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </IconCircle>
        </View>
      </View>

      <Pressable onPress={() => router.push('/(tabs)/contacts')}>
        <Glass radius={18} style={{ marginTop: 18, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text2} strokeWidth={2}>
            <Circle cx={11} cy={11} r={7} />
            <Path d="M21 21l-4-4" />
          </Svg>
          <Text style={{ fontSize: 15, color: tokens.text3, fontFamily: fontFamilies.medium }}>Search messages, people…</Text>
        </Glass>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 14, marginTop: 20 }}>
        <Pressable onPress={() => router.push('/(tabs)/contacts')} style={{ alignItems: 'center', gap: 6 }}>
          <Glass radius={31} style={{ width: 62, height: 62, alignItems: 'center', justifyContent: 'center' }} bordered>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </Glass>
          <Text style={{ fontSize: 11, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Add contact</Text>
        </Pressable>
        {approved.slice(0, 8).map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}`)} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ padding: 2.5, borderRadius: 32 }}>
              <Avatar hue={c.avatar_hue} photoUrl={c.avatar_url} size={58} label={c.display_name || c.username} />
            </View>
            <Text style={{ fontSize: 11, fontFamily: fontFamilies.semibold, color: tokens.text2, maxWidth: 62 }} numberOfLines={1}>
              {c.display_name || c.username}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 9, marginTop: 18, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable key={f} onPress={() => setFilter(f)}>
              {active ? (
                <View
                  style={{
                    paddingVertical: 9,
                    paddingHorizontal: 17,
                    borderRadius: 14,
                    backgroundColor: a1,
                    shadowColor: a2,
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.bold, color: '#fff' }}>{f}</Text>
                </View>
              ) : (
                <Glass radius={14} style={{ paddingVertical: 9, paddingHorizontal: 17 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.bold, color: tokens.text2 }}>{f}</Text>
                </Glass>
              )}
            </Pressable>
          );
        })}
      </View>

      <Glass radius={22} style={{ marginTop: 18, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <View style={{ padding: 28, alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamilies.semibold, color: tokens.text2, textAlign: 'center' }}>
              {rows.length === 0 ? 'No conversations yet — add a contact to start chatting.' : 'Nothing here yet.'}
            </Text>
          </View>
        ) : (
          filtered.map((row, i) => (
            <Pressable
              key={row.id}
              onPress={() => router.push(row.isGroup ? `/group-chat/${row.id}` : `/chat/${row.id}`)}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 16, borderBottomWidth: i === filtered.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder },
                pressed && { backgroundColor: tokens.glassBg2 },
              ]}
            >
              <Avatar hue={row.hue} photoUrl={row.photoUrl} size={54} online={row.online} label={row.name} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15.5, fontFamily: fontFamilies.bold, color: tokens.text }} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.semibold, color: row.unread ? a1 : tokens.text3 }}>{row.time}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                  <Text style={{ fontSize: 13.5, color: row.unread ? tokens.text : tokens.text2, fontFamily: row.unread ? fontFamilies.bold : fontFamilies.medium, flex: 1 }} numberOfLines={1}>
                    {row.preview}
                  </Text>
                  {row.unread > 0 && (
                    <View style={{ marginLeft: 8, minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, backgroundColor: a1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.heavy, color: '#fff' }}>{row.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))
        )}
      </Glass>
    </ScreenScaffold>
  );
}
