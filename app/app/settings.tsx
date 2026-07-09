import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../src/components/ScreenScaffold';
import { Glass } from '../src/components/Glass';
import { GlassField } from '../src/components/GlassField';
import { IconCircle } from '../src/components/Buttons';
import { SwitchToggle } from '../src/components/SwitchToggle';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies, accentPalettes } from '../src/theme/tokens';
import { wallpapers, type WallpaperKey } from '../src/theme/wallpapers';
import { useThemeStore } from '../src/state/themeStore';
import { useSettingsStore } from '../src/state/settingsStore';
import { useAuthStore } from '../src/state/authStore';

const ACCENTS: { key: keyof typeof accentPalettes; label: string }[] = [
  { key: 'purple', label: 'Purple' },
  { key: 'blue', label: 'Blue' },
  { key: 'pink', label: 'Pink' },
  { key: 'green', label: 'Green' },
];

const VISIBILITY: { key: 'everyone' | 'contacts' | 'nobody'; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'contacts', label: 'Contacts only' },
  { key: 'nobody', label: 'Nobody' },
];

export default function SettingsScreen() {
  const { tokens, a1, mode } = useTheme();
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const accentKey = useThemeStore((s) => s.accentKey);
  const setAccent = useThemeStore((s) => s.setAccent);
  const wallpaperKey = useThemeStore((s) => s.wallpaperKey);
  const setWallpaper = useThemeStore((s) => s.setWallpaper);
  const { pushNotifications, showPreviews, toggle } = useSettingsStore();
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const statusVisibility = profile?.status_visibility ?? 'everyone';

  return (
    <ScreenScaffold>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 26, fontFamily: fontFamilies.black, color: tokens.text }}>Settings</Text>
      </View>

      <SectionLabel>Account</SectionLabel>
      <UsernameEditor />

      <SectionLabel>Appearance</SectionLabel>
      <Glass radius={22} style={{ paddingHorizontal: 18 }}>
        <Row icon="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" label="Dark mode" last>
          <SwitchToggle value={mode === 'dark'} onChange={toggleMode} />
        </Row>
      </Glass>

      <SectionLabel>Accent color</SectionLabel>
      <Glass radius={22} style={{ padding: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {ACCENTS.map((a) => {
              const [c1, c2] = accentPalettes[a.key];
              const active = accentKey === a.key;
              return (
                <Pressable key={a.key} onPress={() => setAccent(a.key)} style={{ alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: c2, borderWidth: active ? 3 : 0, borderColor: tokens.text, overflow: 'hidden' }}>
                    <View style={{ flex: 1, backgroundColor: c1, opacity: 0.85 }} />
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Glass>

      <SectionLabel>Background</SectionLabel>
      <Glass radius={22} style={{ padding: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(Object.keys(wallpapers) as WallpaperKey[]).map((key) => {
              const w = wallpapers[key];
              const [c1, c2] = w.swatch;
              const active = wallpaperKey === key;
              return (
                <Pressable key={key} onPress={() => setWallpaper(key)} style={{ alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: c2, borderWidth: active ? 3 : 0, borderColor: tokens.text, overflow: 'hidden' }}>
                    <View style={{ flex: 1, backgroundColor: c1, opacity: 0.85 }} />
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>{w.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Glass>

      <SectionLabel>Notifications</SectionLabel>
      <Glass radius={22} style={{ paddingHorizontal: 18 }}>
        <Row icon="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21a2 2 0 0 0 4 0" label="Push notifications">
          <SwitchToggle value={pushNotifications} onChange={() => toggle('pushNotifications')} />
        </Row>
        <Row icon="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" label="Show message preview" sub="Off by default — pings don't reveal content" last>
          <SwitchToggle value={showPreviews} onChange={() => toggle('showPreviews')} />
        </Row>
      </Glass>

      <SectionLabel>Who can see you're online</SectionLabel>
      <Glass radius={22} style={{ padding: 6 }}>
        {VISIBILITY.map((v, i) => (
          <Pressable key={v.key} onPress={() => updateProfile({ status_visibility: v.key })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: i === VISIBILITY.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
            <Text style={{ fontSize: 14, fontFamily: fontFamilies.semibold, color: tokens.text }}>{v.label}</Text>
            {statusVisibility === v.key && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a1 }} />}
          </Pressable>
        ))}
      </Glass>

      <Pressable onPress={signOut} style={{ marginTop: 22 }}>
        <View style={{ height: 52, borderRadius: 18, backgroundColor: 'rgba(255,90,110,0.12)', borderWidth: 1, borderColor: 'rgba(255,90,110,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#ff5a6e', fontFamily: fontFamilies.bold, fontSize: 14.5 }}>Log out</Text>
        </View>
      </Pressable>
    </ScreenScaffold>
  );
}

function UsernameEditor() {
  const { tokens, a1 } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const changeUsername = useAuthStore((s) => s.changeUsername);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const current = profile?.username ?? '';
  const dirty = draft.trim().toLowerCase() !== '' && draft.trim().toLowerCase() !== current;

  const onSave = async () => {
    setSaving(true);
    const error = await changeUsername(draft);
    setSaving(false);
    if (error) {
      Alert.alert('Could not change username', error);
      return;
    }
    setDraft('');
    Alert.alert('Username changed', `You're now @${draft.trim().toLowerCase()}. Contacts find you by this name.`);
  };

  return (
    <Glass radius={22} style={{ padding: 16, gap: 12 }}>
      <GlassField label={`Username — currently @${current}`} placeholder={current || '@yourname'} autoCapitalize="none" value={draft} onChangeText={setDraft} />
      <Text style={{ fontSize: 11.5, color: tokens.text3, fontFamily: fontFamilies.medium, paddingHorizontal: 4 }}>
        3-24 characters: lowercase letters, numbers, "_" or ".". Must be unique — people add you by @username.
      </Text>
      <Pressable onPress={dirty && !saving ? onSave : undefined}>
        <View style={{ height: 46, borderRadius: 16, backgroundColor: a1, opacity: dirty ? 1 : 0.45, alignItems: 'center', justifyContent: 'center' }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: fontFamilies.bold, fontSize: 14 }}>Save username</Text>}
        </View>
      </Pressable>
    </Glass>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { tokens } = useTheme();
  return <Text style={{ fontSize: 12, fontFamily: fontFamilies.heavy, color: tokens.text3, textTransform: 'uppercase', letterSpacing: 0.8, margin: 4, marginTop: 20, marginBottom: 10 }}>{children}</Text>;
}

function Row({ icon, label, sub, last, children }: { icon: string; label: string; sub?: string; last?: boolean; children: React.ReactNode }) {
  const { tokens, a1 } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9}>
          <Path d={icon} />
        </Svg>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14.5, fontFamily: fontFamilies.bold, color: tokens.text }}>{label}</Text>
          {sub && <Text style={{ fontSize: 11, color: tokens.text2, fontFamily: fontFamilies.medium, marginTop: 1 }}>{sub}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}
