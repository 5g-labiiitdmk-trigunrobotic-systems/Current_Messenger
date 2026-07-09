import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { ScreenTitle } from '../../src/components/Typography';
import { Glass } from '../../src/components/Glass';
import { Avatar } from '../../src/components/Avatar';
import { IconCircle } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useCallStore } from '../../src/state/callStore';
import { useContactStore } from '../../src/state/contactStore';

export default function CallsScreen() {
  const { tokens, a1, a2 } = useTheme();
  const log = useCallStore((s) => s.log);
  const ring = useCallStore((s) => s.ring);
  const approved = useContactStore((s) => s.approved);
  const byId = Object.fromEntries(approved.map((c) => [c.id, c]));

  return (
    <ScreenScaffold bottomInset={90}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle>Calls</ScreenTitle>
        <IconCircle variant="accent" onPress={() => router.push('/(tabs)/contacts')}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14.5 2v6h6M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6" />
          </Svg>
        </IconCircle>
      </View>

      <Glass radius={22} style={{ marginTop: 20, overflow: 'hidden' }}>
        {log.length === 0 ? (
          <View style={{ padding: 28, alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamilies.semibold, color: tokens.text2, textAlign: 'center' }}>
              No calls this session — call logs aren't stored, so this clears on restart too.
            </Text>
          </View>
        ) : (
          log.map((c, i) => {
            const contact = byId[c.peerId];
            const missed = c.direction === 'missed';
            return (
              <View
                key={c.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 16, borderBottomWidth: i === log.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}
              >
                <Avatar hue={contact?.avatar_hue ?? 200} size={50} label={contact?.display_name || contact?.username} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontFamily: fontFamilies.bold, color: missed ? '#ff5a6e' : tokens.text }}>{contact?.display_name ?? contact?.username ?? c.peerId}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.medium }}>
                      {c.direction === 'in' ? 'Incoming' : c.direction === 'out' ? 'Outgoing' : 'Missed'} · {c.kind} · {new Date(c.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => ring(c.peerId, c.kind)}>
                  <Glass radius={20} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9}>
                      {c.kind === 'video' ? <Path d="M23 7l-7 5 7 5V7Z M1 5h15v14H1z" /> : <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />}
                    </Svg>
                  </Glass>
                </Pressable>
              </View>
            );
          })
        )}
      </Glass>
    </ScreenScaffold>
  );
}
