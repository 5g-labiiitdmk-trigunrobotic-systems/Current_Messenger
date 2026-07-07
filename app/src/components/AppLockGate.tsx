import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { BokehBackground } from './BokehBackground';
import { Glass } from './Glass';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';
import { useSettingsStore } from '../state/settingsStore';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const enabled = useSettingsStore((s) => s.biometricLock);
  const { tokens, a1 } = useTheme();
  const [unlocked, setUnlocked] = useState(!enabled);

  const tryUnlock = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      setUnlocked(true); // no biometrics configured on this device — don't hard-lock the user out
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Current' });
    if (result.success) setUnlocked(true);
  };

  useEffect(() => {
    if (enabled && !unlocked) tryUnlock();
  }, [enabled]);

  if (!enabled || unlocked) return <>{children}</>;

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 20 }}>
        <Glass radius={28} style={{ padding: 28, alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 18, fontFamily: fontFamilies.heavy, color: tokens.text }}>Current is locked</Text>
          <Text style={{ fontSize: 13, fontFamily: fontFamilies.medium, color: tokens.text2, textAlign: 'center' }}>Unlock with Face ID / fingerprint to continue.</Text>
          <Pressable onPress={tryUnlock}>
            <View style={{ marginTop: 6, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, backgroundColor: a1 }}>
              <Text style={{ color: '#fff', fontFamily: fontFamilies.bold }}>Unlock</Text>
            </View>
          </Pressable>
        </Glass>
      </View>
    </View>
  );
}
