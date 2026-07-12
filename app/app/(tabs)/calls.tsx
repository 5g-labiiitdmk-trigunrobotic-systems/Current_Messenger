import React, { useEffect, useRef, useState } from 'react';
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
import { supabase } from '../../src/lib/supabase';
import type { UserRow } from '../../src/types/database';

export default function CallsScreen() {
  const { tokens, a1, a2 } = useTheme();
  const log = useCallStore((s) => s.log);
  const ring = useCallStore((s) => s.ring);
  const approved = useContactStore((s) => s.approved);
  const byId = Object.fromEntries(approved.map((c) => [c.id, c]));

  // approved-contacts lookup alone can't resolve everyone in the call log:
  // a call log entry persists locally regardless of whether that person is
  // still an approved contact (removed, or blocked, since the call) —
  // `byId` only ever has *currently* approved contacts, so any log entry
  // for someone no longer in that list fell through to showing the raw
  // peerId UUID. This resolves those directly against the users table
  // instead, same as e.g. privacy.tsx already does for a single id.
  const [resolvedUsers, setResolvedUsers] = useState<Record<string, UserRow>>({});
  const attemptedIds = useRef(new Set<string>());
  useEffect(() => {
    const missing = Array.from(new Set(log.map((c) => c.peerId))).filter((id) => !byId[id] && !resolvedUsers[id] && !attemptedIds.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => attemptedIds.current.add(id));
    supabase
      .from('users')
      .select('*')
      .in('id', missing)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setResolvedUsers((prev) => {
          const next = { ...prev };
          for (const u of data as UserRow[]) next[u.id] = u;
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, approved]);

  return (
    <ScreenScaffold tabBar>
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
              No calls yet — your call history is saved on this device only, encrypted at rest.
            </Text>
          </View>
        ) : (
          log.map((c, i) => {
            const contact = byId[c.peerId] ?? resolvedUsers[c.peerId];
            const missed = c.direction === 'missed';
            return (
              <View
                key={c.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 16, borderBottomWidth: i === log.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}
              >
                <Avatar hue={contact?.avatar_hue ?? 200} photoUrl={contact?.avatar_url} size={50} label={contact?.display_name || contact?.username} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontFamily: fontFamilies.bold, color: missed ? '#ff5a6e' : tokens.text }}>{contact?.display_name ?? contact?.username ?? c.peerId}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.medium }}>
                      {c.direction === 'in' ? 'Incoming' : c.direction === 'out' ? 'Outgoing' : 'Missed'} · {c.kind}
                      {c.durationSec !== undefined ? ` · ${Math.floor(c.durationSec / 60)}:${String(c.durationSec % 60).padStart(2, '0')}` : ''} ·{' '}
                      {new Date(c.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
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
