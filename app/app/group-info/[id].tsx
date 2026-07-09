import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { Glass } from '../../src/components/Glass';
import { Avatar } from '../../src/components/Avatar';
import { IconCircle } from '../../src/components/Buttons';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useGroupStore } from '../../src/state/groupStore';
import { useContactStore } from '../../src/state/contactStore';
import { useAuthStore } from '../../src/state/authStore';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens, a1, a2 } = useTheme();
  const group = useGroupStore((s) => s.groups[id ?? '']);
  const leave = useGroupStore((s) => s.leave);
  const approved = useContactStore((s) => s.approved);
  const me = useAuthStore((s) => s.session?.user.id);

  if (!group) {
    return (
      <ScreenScaffold>
        <Text style={{ marginTop: 100, textAlign: 'center', color: tokens.text }}>Group not found.</Text>
      </ScreenScaffold>
    );
  }

  const members = group.memberIds.map((uid) => {
    if (uid === me) return { id: uid, name: 'You', hue: 265, isAdmin: uid === group.ownerId };
    const c = approved.find((c) => c.id === uid);
    return { id: uid, name: c?.display_name ?? c?.username ?? 'Member', hue: c?.avatar_hue ?? 200, isAdmin: uid === group.ownerId };
  });

  const onLeave = () => {
    Alert.alert('Leave group', `Leave ${group.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          leave(group.id);
          router.replace('/(tabs)/chats');
        },
      },
    ]);
  };

  return (
    <ScreenScaffold>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 22, fontFamily: fontFamilies.black, color: tokens.text }}>Group info</Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <LinearGradient colors={[a1, a2]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={{ width: 92, height: 92, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
            <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <Circle cx={9} cy={7} r={4} />
          </Svg>
        </LinearGradient>
        <Text style={{ fontSize: 22, fontFamily: fontFamilies.black, color: tokens.text, marginTop: 14 }}>{group.name}</Text>
        <Text style={{ fontSize: 13, fontFamily: fontFamilies.medium, color: tokens.text2, marginTop: 2 }}>
          {group.memberIds.length} members{group.isBroadcast ? ' · broadcast channel' : ''}
        </Text>
      </View>

      <Text style={{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8, margin: 4, marginTop: 24, marginBottom: 10 }}>Members</Text>
      <Glass radius={22} style={{ overflow: 'hidden' }}>
        {members.map((m, i) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, paddingHorizontal: 16, borderBottomWidth: i === members.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
            <Avatar hue={m.hue} size={46} label={m.name} />
            <Text style={{ flex: 1, fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text }}>{m.name}</Text>
            {m.isAdmin && (
              <View style={{ paddingVertical: 5, paddingHorizontal: 11, borderRadius: 10, backgroundColor: 'rgba(124,92,255,0.18)' }}>
                <Text style={{ fontSize: 11, fontFamily: fontFamilies.heavy, color: a1 }}>Admin</Text>
              </View>
            )}
          </View>
        ))}
      </Glass>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Glass radius={18} style={{ height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={2}>
            <Path d="M4 11h16v10H4z" />
            <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </Svg>
          <Text style={{ color: tokens.text, fontFamily: fontFamilies.bold, fontSize: 14.5 }}>Encryption keys</Text>
        </Glass>
        <Pressable onPress={onLeave}>
          <View style={{ height: 52, borderRadius: 18, backgroundColor: 'rgba(255,90,110,0.12)', borderWidth: 1, borderColor: 'rgba(255,90,110,0.3)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ff5a6e" strokeWidth={2} strokeLinecap="round">
              <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </Svg>
            <Text style={{ color: '#ff5a6e', fontFamily: fontFamilies.bold, fontSize: 14.5 }}>Leave group</Text>
          </View>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}
