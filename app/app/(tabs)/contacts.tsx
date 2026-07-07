import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { ScreenTitle, Label } from '../../src/components/Typography';
import { Glass } from '../../src/components/Glass';
import { Avatar } from '../../src/components/Avatar';
import { IconCircle } from '../../src/components/Buttons';
import { GlassField } from '../../src/components/GlassField';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useContactStore } from '../../src/state/contactStore';
import { usePresenceStore } from '../../src/state/presenceStore';
import { isPresenceVisible } from '../../src/lib/presencePolicy';
import type { UserRow } from '../../src/types/database';

export default function ContactsScreen() {
  const { tokens, a1, a2 } = useTheme();
  const { approved, incoming, outgoing, refresh, searchByUsername, sendRequest, respond } = useContactStore();
  const presence = usePresenceStore((s) => s.byUser);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length >= 2) setResults(await searchByUsername(query));
      else setResults([]);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const outgoingIds = new Set(outgoing.map((r) => r.otherUser.id));
  const approvedIds = new Set(approved.map((c) => c.id));
  const onlineNow = approved.filter((c) => isPresenceVisible(c) && presence[c.id]?.status === 'online');

  return (
    <ScreenScaffold bottomInset={90}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle>Contacts</ScreenTitle>
        <IconCircle onPress={() => router.push('/qr')}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2}>
            <Rect x={3} y={3} width={7} height={7} rx={1} />
            <Rect x={14} y={3} width={7} height={7} rx={1} />
            <Rect x={3} y={14} width={7} height={7} rx={1} />
            <Path d="M14 14h3v3M21 14v.01M14 21h.01M21 21v-3M17 21h.01" />
          </Svg>
        </IconCircle>
      </View>

      <View style={{ flexDirection: 'row', gap: 11, marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <GlassField label="Search" placeholder="Search by @username" autoCapitalize="none" value={query} onChangeText={setQuery} />
        </View>
        <Pressable onPress={() => router.push('/qr')}>
          <Glass radius={16} style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={2}>
              <Rect x={3} y={3} width={7} height={7} rx={1} />
              <Rect x={14} y={3} width={7} height={7} rx={1} />
              <Rect x={3} y={14} width={7} height={7} rx={1} />
              <Path d="M14 14h7v7h-7z" />
            </Svg>
          </Glass>
        </Pressable>
      </View>

      {results.length > 0 && (
        <Glass radius={22} style={{ marginTop: 12, overflow: 'hidden' }}>
          {results.map((u, i) => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i === results.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
              <Avatar hue={u.avatar_hue} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamilies.bold, color: tokens.text, fontSize: 14.5 }}>{u.display_name || u.username}</Text>
                <Text style={{ fontFamily: fontFamilies.medium, color: tokens.text2, fontSize: 12.5 }}>@{u.username}</Text>
              </View>
              {approvedIds.has(u.id) ? (
                <Text style={{ fontFamily: fontFamilies.bold, color: tokens.text3, fontSize: 12.5 }}>Contact</Text>
              ) : outgoingIds.has(u.id) ? (
                <Text style={{ fontFamily: fontFamilies.bold, color: tokens.text3, fontSize: 12.5 }}>Requested</Text>
              ) : (
                <Pressable onPress={() => sendRequest(u.id)}>
                  <View style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 12, backgroundColor: a1 }}>
                    <Text style={{ fontFamily: fontFamilies.bold, color: '#fff', fontSize: 12.5 }}>Add</Text>
                  </View>
                </Pressable>
              )}
            </View>
          ))}
        </Glass>
      )}

      {incoming.length > 0 && (
        <>
          <Label style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>Contact requests</Label>
          <Glass radius={22} style={{ overflow: 'hidden' }}>
            {incoming.map((r, i) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i === incoming.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
                <Avatar hue={r.otherUser.avatar_hue} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fontFamilies.bold, color: tokens.text, fontSize: 14.5 }}>{r.otherUser.display_name || r.otherUser.username}</Text>
                  <Text style={{ fontFamily: fontFamilies.medium, color: tokens.text2, fontSize: 12.5 }}>wants to add you</Text>
                </View>
                <Pressable onPress={() => respond(r.id, false)} style={{ marginRight: 6 }}>
                  <Glass radius={14} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#ff5a6e', fontFamily: fontFamilies.bold }}>✕</Text>
                  </Glass>
                </Pressable>
                <Pressable onPress={() => respond(r.id, true)}>
                  <View style={{ width: 34, height: 34, borderRadius: 14, backgroundColor: a1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontFamily: fontFamilies.bold }}>✓</Text>
                  </View>
                </Pressable>
              </View>
            ))}
          </Glass>
        </>
      )}

      <Pressable onPress={() => router.push('/new-group')}>
        <Glass radius={20} style={{ marginTop: 14, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 }} variant="bg2">
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: a1, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
              <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <Circle cx={9} cy={7} r={4} />
              <Path d="M19 8v6M22 11h-6" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15.5, fontFamily: fontFamilies.bold, color: tokens.text }}>New group</Text>
            <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.medium, marginTop: 2 }}>Start a live, encrypted group chat</Text>
          </View>
        </Glass>
      </Pressable>

      {onlineNow.length > 0 && (
        <>
          <Label style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>Online now</Label>
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {onlineNow.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}`)} style={{ alignItems: 'center', gap: 6 }}>
                <Avatar hue={c.avatar_hue} size={58} online />
                <Text style={{ fontSize: 11, fontFamily: fontFamilies.semibold, color: tokens.text2, maxWidth: 60 }} numberOfLines={1}>
                  {c.display_name || c.username}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Label style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>All contacts</Label>
      <Glass radius={26} style={{ overflow: 'hidden' }}>
        {approved.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamilies.semibold, color: tokens.text2, textAlign: 'center' }}>No contacts yet — search by username or scan a QR code to add someone.</Text>
          </View>
        ) : (
          approved.map((c, i) => (
            <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 11, paddingHorizontal: 16, borderBottomWidth: i === approved.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
              <Avatar hue={c.avatar_hue} size={46} online={isPresenceVisible(c) && presence[c.id]?.status === 'online'} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text }}>{c.display_name || c.username}</Text>
                <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.medium, marginTop: 1 }}>@{c.username}</Text>
              </View>
            </Pressable>
          ))
        )}
      </Glass>
    </ScreenScaffold>
  );
}
