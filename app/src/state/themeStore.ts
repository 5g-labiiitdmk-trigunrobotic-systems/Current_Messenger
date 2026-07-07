import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import type { Mode } from '../theme/tokens';

interface ThemeState {
  mode: Mode;
  accentKey: 'purple' | 'blue' | 'pink' | 'green';
  hydrated: boolean;
  toggleMode: () => void;
  setMode: (m: Mode) => void;
  setAccent: (k: ThemeState['accentKey']) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: (Appearance.getColorScheme() as Mode) ?? 'light',
      accentKey: 'purple',
      hydrated: false,
      toggleMode: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
      setMode: (m) => set({ mode: m }),
      setAccent: (k) => set({ accentKey: k }),
    }),
    {
      name: 'current-theme',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
