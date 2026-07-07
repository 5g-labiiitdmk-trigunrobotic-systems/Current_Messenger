import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device-local preferences only — not message content, safe to persist locally. */
interface SettingsState {
  biometricLock: boolean;
  pushNotifications: boolean;
  showPreviews: boolean;
  toggle: (key: 'biometricLock' | 'pushNotifications' | 'showPreviews') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      biometricLock: false,
      pushNotifications: true,
      showPreviews: false,
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
    }),
    { name: 'current-settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);
