import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { BokehBackground } from './BokehBackground';
import { Glass } from './Glass';
import { useTheme } from '../theme/useTheme';
import { fontFamilies } from '../theme/tokens';
import { useSettingsStore } from '../state/settingsStore';
import { startsUnlocked, shouldLockOnAppState } from '../lib/appLockLogic';

/**
 * FILE PURPOSE: Wraps the whole app (see _layout.tsx) and gates
 * rendering `children` behind a biometric prompt whenever the
 * biometricLock setting is on — shows a "Current is locked" screen with
 * a manual "Unlock" retry until authentication succeeds. A no-op pass-
 * through when the setting is off, or when this device has no
 * biometrics configured at all (rather than locking the user out with
 * no way to unlock).
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const enabled = useSettingsStore((s) => s.biometricLock);
  const { tokens, a1 } = useTheme();
  // The saved settings load asynchronously. Before they have, `enabled` is
  // just the default (false), so the gate must not treat that as "lock off".
  const [loaded, setLoaded] = useState(() => useSettingsStore.persist.hasHydrated());
  const [unlocked, setUnlocked] = useState(false);
  const authenticating = useRef(false);

  useEffect(() => {
    if (loaded) return;
    const off = useSettingsStore.persist.onFinishHydration(() => setLoaded(true));
    if (useSettingsStore.persist.hasHydrated()) setLoaded(true);
    return off;
  }, [loaded]);

  // tryUnlock(): checks hardware/enrollment first (bailing open if
  // biometrics genuinely aren't available), then prompts.
  const tryUnlock = async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setUnlocked(true); // no biometrics configured on this device — don't hard-lock the user out
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Current' });
      if (result.success) setUnlocked(true);
    } finally {
      authenticating.current = false;
    }
  };

  // Once settings are known: open straight away if the lock is off,
  // otherwise prompt automatically (rather than waiting for a tap).
  useEffect(() => {
    if (!loaded) return;
    if (startsUnlocked(loaded, enabled)) setUnlocked(true);
    else if (!unlocked) tryUnlock();
  }, [loaded, enabled]);

  // Lock again every time the app goes to the background; prompt on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (shouldLockOnAppState(next, useSettingsStore.getState().biometricLock, authenticating.current)) setUnlocked(false);
      if (next === 'active' && useSettingsStore.getState().biometricLock && !authenticating.current) {
        setTimeout(() => {
          if (useSettingsStore.getState().biometricLock) tryUnlockIfLocked();
        }, 0);
      }
    });
    return () => sub.remove();
  }, []);
  const lockedRef = useRef(true);
  lockedRef.current = !unlocked;
  const tryUnlockIfLocked = () => {
    if (lockedRef.current) tryUnlock();
  };

  // Settings not loaded yet: show the locked backdrop, never the app.
  if (!loaded) return <View style={{ flex: 1 }}><BokehBackground /></View>;

  if (!enabled || unlocked) return <>{children}</>;

  return (
    <View style={{ flex: 1 }}>
      <BokehBackground />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 20 }}>
        <Glass radius={22} style={{ padding: 28, alignItems: 'center', gap: 14 }}>
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
