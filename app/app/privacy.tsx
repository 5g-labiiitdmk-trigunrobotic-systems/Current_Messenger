import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { ScreenScaffold } from '../src/components/ScreenScaffold';
import { Glass } from '../src/components/Glass';
import { Avatar } from '../src/components/Avatar';
import { IconCircle } from '../src/components/Buttons';
import { SwitchToggle } from '../src/components/SwitchToggle';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';
import { useSettingsStore } from '../src/state/settingsStore';
import { useContactStore } from '../src/state/contactStore';
import { useAuthStore } from '../src/state/authStore';
import { supabase } from '../src/lib/supabase';
import type { DeviceKeyRow } from '../src/types/database';

export default function PrivacyScreen() {
  const { tokens, a1, a2 } = useTheme();
  const biometricLock = useSettingsStore((s) => s.biometricLock);
  const toggle = useSettingsStore((s) => s.toggle);
  const me = useAuthStore((s) => s.session?.user.id);
  const { blocked, unblock, searchByUsername } = useContactStore();
  const [devices, setDevices] = useState<DeviceKeyRow[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!me) return;
    supabase
      .from('device_keys')
      .select('*')
      .eq('user_id', me)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDevices((data as DeviceKeyRow[]) ?? []));
  }, [me]);

  useEffect(() => {
    (async () => {
      const entries: Record<string, string> = {};
      for (const id of blocked) {
        const { data } = await supabase.from('users').select('username').eq('id', id).maybeSingle();
        if (data) entries[id] = data.username;
      }
      setBlockedProfiles(entries);
    })();
  }, [blocked]);

  const score = 100 - (biometricLock ? 0 : 10);

  return (
    <ScreenScaffold>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 24, fontFamily: fontFamilies.black, color: tokens.text }}>Privacy Dashboard</Text>
      </View>

      <Glass radius={26} style={{ marginTop: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: '#15a55c', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4ZM9 12l2 2 4-4" />
          </Svg>
        </View>
        <View>
          <Text style={{ fontSize: 16, fontFamily: fontFamilies.heavy, color: tokens.text }}>You're fully encrypted</Text>
          <Text style={{ fontSize: 12.5, color: tokens.text2, fontFamily: fontFamilies.medium, marginTop: 2 }}>All 1-1 chats are end-to-end secured, live-relay only</Text>
        </View>
      </Glass>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <Glass radius={24} style={{ flex: 1, padding: 18, alignItems: 'center' }}>
          <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={88} height={88} viewBox="0 0 88 88" style={{ transform: [{ rotate: '-90deg' }] }}>
              <Defs>
                <SvgLinearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={a1} />
                  <Stop offset="1" stopColor={a2} />
                </SvgLinearGradient>
              </Defs>
              <Circle cx={44} cy={44} r={38} stroke={tokens.field} strokeWidth={8} fill="none" />
              <Circle cx={44} cy={44} r={38} stroke="url(#sg)" strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={239} strokeDashoffset={239 * (1 - score / 100)} />
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontFamily: fontFamilies.black, color: tokens.text }}>{score}</Text>
              <Text style={{ fontSize: 9, fontFamily: fontFamilies.bold, color: tokens.text3 }}>/100</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.bold, color: tokens.text, marginTop: 10 }}>Security score</Text>
        </Glass>
        <Glass radius={24} style={{ flex: 1, padding: 18, justifyContent: 'center', gap: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 30, fontFamily: fontFamilies.black, color: tokens.text }}>{devices.length}</Text>
            <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.semibold, color: tokens.text2, marginTop: 4 }}>Active devices</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 30, fontFamily: fontFamilies.black, color: tokens.text }}>{blocked.length}</Text>
            <Text style={{ fontSize: 11.5, fontFamily: fontFamilies.semibold, color: tokens.text2, marginTop: 4 }}>Blocked users</Text>
          </View>
        </Glass>
      </View>

      <Glass radius={22} style={{ marginTop: 14, paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.glassBorder }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9}>
              <Path d="M4 11h16v10H4z" />
              <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </Svg>
            <View>
              <Text style={{ fontSize: 14.5, fontFamily: fontFamilies.bold, color: tokens.text }}>Two-factor verification</Text>
              <Text style={{ fontSize: 11.5, color: tokens.text2, fontFamily: fontFamilies.medium }}>Email + phone, always required</Text>
            </View>
          </View>
          <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(52,210,123,0.16)' }}>
            <Text style={{ fontSize: 11, fontFamily: fontFamilies.bold, color: '#15a55c' }}>Always on</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9}>
              <Circle cx={12} cy={12} r={3} />
              <Path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4" />
            </Svg>
            <View>
              <Text style={{ fontSize: 14.5, fontFamily: fontFamilies.bold, color: tokens.text }}>Biometric lock</Text>
              <Text style={{ fontSize: 11.5, color: tokens.text2, fontFamily: fontFamilies.medium }}>Face ID / fingerprint to open app</Text>
            </View>
          </View>
          <SwitchToggle value={biometricLock} onChange={() => toggle('biometricLock')} />
        </View>
      </Glass>

      <Text style={{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8, margin: 4, marginTop: 20, marginBottom: 10 }}>Active devices</Text>
      <Glass radius={22} style={{ overflow: 'hidden' }}>
        {devices.length === 0 ? (
          <Text style={{ padding: 16, color: tokens.text2, fontFamily: fontFamilies.medium }}>No device keys published yet.</Text>
        ) : (
          devices.map((d, i) => (
            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 16, borderBottomWidth: i === devices.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
              <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={1.8}>
                  <Path d="M6 2h12v20H6z" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: fontFamilies.bold, color: tokens.text }}>{d.device_label}</Text>
                <Text style={{ fontSize: 11.5, color: tokens.text2, fontFamily: fontFamilies.medium }}>Key added {new Date(d.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))
        )}
      </Glass>

      <Text style={{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8, margin: 4, marginTop: 20, marginBottom: 10 }}>Blocked users</Text>
      <Glass radius={22} style={{ overflow: 'hidden' }}>
        {blocked.length === 0 ? (
          <Text style={{ padding: 16, color: tokens.text2, fontFamily: fontFamilies.medium }}>No one is blocked.</Text>
        ) : (
          blocked.map((id, i) => (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 16, borderBottomWidth: i === blocked.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
              <Text style={{ flex: 1, fontSize: 14, fontFamily: fontFamilies.bold, color: tokens.text }}>@{blockedProfiles[id] ?? id}</Text>
              <Pressable onPress={() => unblock(id)}>
                <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.bold, color: a1 }}>Unblock</Text>
              </Pressable>
            </View>
          ))
        )}
      </Glass>
    </ScreenScaffold>
  );
}
