import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../src/components/ScreenScaffold';
import { Glass } from '../src/components/Glass';
import { IconCircle } from '../src/components/Buttons';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';
import { useAuthStore } from '../src/state/authStore';
import { useContactStore } from '../src/state/contactStore';

const QR_PREFIX = 'current-user:';

export default function QrScreen() {
  const { tokens, a1 } = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const sendRequest = useContactStore((s) => s.sendRequest);
  const [tab, setTab] = useState<'mine' | 'scan'>('mine');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const onScan = (result: { data: string }) => {
    if (scanned) return;
    if (!result.data.startsWith(QR_PREFIX)) return;
    setScanned(true);
    const userId = result.data.slice(QR_PREFIX.length);
    Alert.alert('Add contact', 'Send a contact request to this user?', [
      { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
      {
        text: 'Send request',
        onPress: async () => {
          await sendRequest(userId);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScreenScaffold scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 22, fontFamily: fontFamilies.black, color: tokens.text }}>QR code</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        {(['mine', 'scan'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1 }}>
            <Glass radius={14} variant={tab === t ? 'bg2' : 'bg'} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ fontFamily: fontFamilies.bold, color: tab === t ? tokens.text : tokens.text2, fontSize: 13.5 }}>{t === 'mine' ? 'My code' : 'Scan'}</Text>
            </Glass>
          </Pressable>
        ))}
      </View>

      {tab === 'mine' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Glass radius={22} style={{ padding: 28, alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 20 }}>
              <QRCode value={`${QR_PREFIX}${profile?.id ?? ''}`} size={200} color="#1c1830" backgroundColor="#fff" />
            </View>
            <Text style={{ marginTop: 16, fontSize: 16, fontFamily: fontFamilies.heavy, color: tokens.text }}>{profile?.display_name || profile?.username}</Text>
            <Text style={{ fontSize: 13, fontFamily: fontFamilies.medium, color: tokens.text2 }}>@{profile?.username}</Text>
          </Glass>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {!permission?.granted ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <Text style={{ color: tokens.text2, fontFamily: fontFamilies.medium, textAlign: 'center', paddingHorizontal: 30 }}>Camera access is needed to scan a contact's QR code.</Text>
              <Pressable onPress={requestPermission}>
                <View style={{ paddingVertical: 12, paddingHorizontal: 22, borderRadius: 16, backgroundColor: a1 }}>
                  <Text style={{ color: '#fff', fontFamily: fontFamilies.bold }}>Grant access</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Square viewfinder. The camera preview is a native surface on
                  Android, so parent borderRadius/overflow clipping is
                  unreliable — instead the camera absolutely fills a
                  fixed-aspect square (default FILL scale type crops to the
                  view bounds; do NOT set `ratio`, which flips it to FIT and
                  letterboxes the raw feed) and the "frame" is drawn as a
                  corner-bracket overlay on top. */}
              <View style={{ width: '86%', aspectRatio: 1, overflow: 'hidden', borderRadius: 26 }}>
                <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : onScan} />
                <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
                  <Path d="M8 26 V14 a6 6 0 0 1 6-6 H26" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" fill="none" />
                  <Path d="M74 8 H86 a6 6 0 0 1 6 6 V26" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" fill="none" />
                  <Path d="M92 74 V86 a6 6 0 0 1-6 6 H74" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" fill="none" />
                  <Path d="M26 92 H14 a6 6 0 0 1-6-6 V74" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" fill="none" />
                </Svg>
              </View>
              <Text style={{ marginTop: 18, fontSize: 13, fontFamily: fontFamilies.medium, color: tokens.text2, textAlign: 'center' }}>
                Point at a contact's Current QR code
              </Text>
            </>
          )}
        </View>
      )}
    </ScreenScaffold>
  );
}
