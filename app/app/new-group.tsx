import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../src/components/ScreenScaffold';
import { Glass } from '../src/components/Glass';
import { Avatar } from '../src/components/Avatar';
import { GlassField } from '../src/components/GlassField';
import { IconCircle } from '../src/components/Buttons';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';
import { useContactStore } from '../src/state/contactStore';
import { useGroupStore } from '../src/state/groupStore';
import { appAlert } from '../src/state/alertStore';

export default function NewGroupScreen() {
  const { tokens, a1 } = useTheme();
  const approved = useContactStore((s) => s.approved);
  const refresh = useContactStore((s) => s.refresh);
  const createGroup = useGroupStore((s) => s.createGroup);
  const [name, setName] = useState('');
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    refresh();
  }, []);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onCreate = () => {
    if (!name.trim()) {
      appAlert('Name your group', 'Give the group a name before creating it.');
      return;
    }
    if (selected.size === 0) {
      appAlert('Invite members', 'Select at least one contact to invite.');
      return;
    }
    const groupId = createGroup(name.trim(), [...selected], isBroadcast);
    router.replace(`/group-chat/${groupId}`);
  };

  return (
    <ScreenScaffold>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 17, fontFamily: fontFamilies.heavy, color: tokens.text }}>New group</Text>
        <Pressable onPress={onCreate}>
          <View style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 14, backgroundColor: a1 }}>
            <Text style={{ color: '#fff', fontFamily: fontFamilies.bold, fontSize: 14 }}>Create</Text>
          </View>
        </Pressable>
      </View>

      <View style={{ marginTop: 22 }}>
        <GlassField label="Group name" placeholder="Weekend Trip ✈️" value={name} onChangeText={setName} />
      </View>

      <Pressable onPress={() => setIsBroadcast((b) => !b)}>
        <Glass radius={18} style={{ marginTop: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }} variant="bg2">
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: tokens.glassBorder, backgroundColor: isBroadcast ? a1 : tokens.field, alignItems: 'center', justifyContent: 'center' }}>
            {isBroadcast && (
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 6L9 17l-5-5" />
              </Svg>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: fontFamilies.bold, color: tokens.text }}>Broadcast channel</Text>
            <Text style={{ fontSize: 12, color: tokens.text2, fontFamily: fontFamilies.medium }}>Only you can post — members receive live, nothing archived</Text>
          </View>
        </Glass>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>
        <Text style={{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8 }}>Invite members</Text>
        <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.bold, color: a1 }}>{selected.size} selected</Text>
      </View>

      <Glass radius={22} style={{ overflow: 'hidden' }}>
        {approved.map((c, i) => {
          const checked = selected.has(c.id);
          return (
            <Pressable key={c.id} onPress={() => toggle(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 11, paddingHorizontal: 16, borderBottomWidth: i === approved.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
              <Avatar hue={c.avatar_hue} photoUrl={c.avatar_url} size={44} label={c.display_name || c.username} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text }}>{c.display_name || c.username}</Text>
                <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.medium }}>@{c.username}</Text>
              </View>
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: tokens.glassBorder, backgroundColor: checked ? a1 : tokens.field, alignItems: 'center', justifyContent: 'center' }}>
                {checked && (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6L9 17l-5-5" />
                  </Svg>
                )}
              </View>
            </Pressable>
          );
        })}
      </Glass>
    </ScreenScaffold>
  );
}
