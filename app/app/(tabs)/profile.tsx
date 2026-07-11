import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { ScreenScaffold } from '../../src/components/ScreenScaffold';
import { ScreenTitle } from '../../src/components/Typography';
import { Glass } from '../../src/components/Glass';
import { Avatar } from '../../src/components/Avatar';
import { IconCircle } from '../../src/components/Buttons';
import { ShimmerSweep } from '../../src/components/ShimmerSweep';
import { useTheme } from '../../src/theme/useTheme';
import { fontFamilies } from '../../src/theme/tokens';
import { useAuthStore } from '../../src/state/authStore';
import { pickAvatarImage } from '../../src/lib/media';
import { appAlert } from '../../src/state/alertStore';

const SETTINGS = [
  { key: 'account', label: 'Account', sub: 'Username, email', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-7 8-7s8 3 8 7', route: '/settings' as const },
  { key: 'privacy', label: 'Privacy & Security', sub: 'Encryption, verification, blocked', icon: 'M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4ZM9 12l2 2 4-4', route: '/privacy' as const },
  { key: 'notif', label: 'Notifications', sub: 'Push, sounds, previews', icon: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21a2 2 0 0 0 4 0', route: '/settings' as const },
  { key: 'appearance', label: 'Appearance', sub: 'Theme, wallpaper, mode', icon: 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4', route: '/settings' as const },
  { key: 'devices', label: 'Devices', sub: 'Active sessions & keys', icon: 'M4 4h16v12H4zM2 20h20M9 16v4M15 16v4', route: '/privacy' as const },
  { key: 'lab', label: 'Lab', sub: 'AR filters, games, bots — coming soon', icon: 'M9 2v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V2M9 2h6', route: '/lab' as const },
  { key: 'help', label: 'Help & Support', sub: 'FAQ, contact, about', icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01', route: '/help' as const },
];

export default function ProfileScreen() {
  const { tokens, a1 } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const profileError = useAuthStore((s) => s.profileError);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const onPickAvatar = async (source: 'camera' | 'library') => {
    const picked = await pickAvatarImage(source);
    if (!picked) return;
    setUploadingAvatar(true);
    const err = await uploadAvatar(picked.base64, picked.mime);
    setUploadingAvatar(false);
    if (err) appAlert('Could not update photo', err);
  };

  const onAvatarPress = () => {
    appAlert('Profile photo', 'Optional — visible to your contacts, same as your username.', [
      { text: 'Take photo', onPress: () => onPickAvatar('camera') },
      { text: 'Choose from library', onPress: () => onPickAvatar('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScreenScaffold tabBar>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ScreenTitle>Profile</ScreenTitle>
        <IconCircle onPress={() => router.push('/settings')}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={1.9}>
            <Circle cx={12} cy={12} r={3} />
            <Path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
          </Svg>
        </IconCircle>
      </View>

      {profileError && !profile && (
        <Pressable onPress={() => refreshProfile()}>
          <Glass radius={22} style={{ marginTop: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: 'rgba(255,90,110,0.35)' }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ff5a6e" strokeWidth={2}>
              <Path d="M12 9v4M12 17h.01" />
              <Circle cx={12} cy={12} r={9} />
            </Svg>
            <Text style={{ flex: 1, fontSize: 12.5, fontFamily: fontFamilies.semibold, color: tokens.text2 }}>Couldn't load your profile — tap to retry</Text>
          </Glass>
        </Pressable>
      )}

      <Glass radius={22} style={{ marginTop: 22, padding: 24, alignItems: 'center' }}>
        <ShimmerSweep />
        <Pressable onPress={onAvatarPress} disabled={uploadingAvatar} style={{ width: 104, height: 104 }}>
          <Avatar
            hue={profile?.avatar_hue ?? 265}
            photoUrl={profile?.avatar_url}
            size={104}
            online
            ringWidth={3}
            label={profile?.display_name || profile?.username}
          />
          {uploadingAvatar && (
            <View
              style={{
                position: 'absolute',
                width: 104,
                height: 104,
                borderRadius: 52,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: a1,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: tokens.glassBg,
            }}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
              <Circle cx={12} cy={13} r={4} />
            </Svg>
          </View>
        </Pressable>
        <Text style={{ fontSize: 23, fontFamily: fontFamilies.black, color: tokens.text, marginTop: 14 }}>{profile?.display_name || profile?.username || '—'}</Text>
        <Text style={{ fontSize: 14, color: tokens.text2, fontFamily: fontFamilies.semibold }}>@{profile?.username ?? ''}</Text>
        <Pressable
          onPress={() => router.push('/privacy')}
          style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(124,92,255,0.16)', borderWidth: 1, borderColor: tokens.glassBorder }}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={2.3}>
            <Path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-4Z" />
          </Svg>
          <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.bold, color: a1 }}>View privacy dashboard</Text>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 18l6-6-6-6" />
          </Svg>
        </Pressable>
      </Glass>

      <Glass radius={22} style={{ marginTop: 16, padding: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13.5, fontFamily: fontFamilies.bold, color: tokens.text }}>Server-side storage</Text>
          <Text style={{ fontSize: 12.5, fontFamily: fontFamilies.semibold, color: '#34d27b' }}>0 bytes, always</Text>
        </View>
        <Text style={{ fontSize: 12, color: tokens.text2, fontFamily: fontFamilies.regular, marginTop: 6, lineHeight: 17 }}>
          Messages relay live and are never written to any server-side database — not even ours, not even encrypted, not even temporarily. They're
          saved only on your own device, encrypted at rest, purely for your local chat history.
        </Text>
      </Glass>

      <Glass radius={22} style={{ marginTop: 16, overflow: 'hidden' }}>
        {SETTINGS.map((s, i) => (
          <Pressable key={s.key} onPress={() => router.push(s.route)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderBottomWidth: i === SETTINGS.length - 1 ? 0 : 1, borderBottomColor: tokens.glassBorder }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: tokens.glassBg2, borderWidth: 1, borderColor: tokens.glassBorder, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={a1} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d={s.icon} />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontFamily: fontFamilies.bold, color: tokens.text }}>{s.label}</Text>
              <Text style={{ fontSize: 12, color: tokens.text2, fontFamily: fontFamilies.medium, marginTop: 1 }}>{s.sub}</Text>
            </View>
            <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={tokens.text3} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </Pressable>
        ))}
      </Glass>
    </ScreenScaffold>
  );
}
