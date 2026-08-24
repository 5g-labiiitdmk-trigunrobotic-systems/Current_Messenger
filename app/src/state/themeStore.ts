import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import type { Mode } from '../theme/tokens';
import type { WallpaperKey } from '../theme/wallpapers';

// FILE PURPOSE: Persisted user theme preferences (light/dark mode, accent
// color, chat wallpaper) — defaults to the OS color scheme on first launch.
// `hydrated` lets screens defer rendering theme-dependent UI until the
// persisted value has actually loaded (see onRehydrateStorage below).
interface ThemeState {
  mode: Mode;
  accentKey: 'purple' | 'blue' | 'pink' | 'green';
  wallpaperKey: WallpaperKey;
  hydrated: boolean;
  toggleMode: () => void;
  setMode: (m: Mode) => void;
  setAccent: (k: ThemeState['accentKey']) => void;
  setWallpaper: (k: WallpaperKey) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: (Appearance.getColorScheme() as Mode) ?? 'light',
      accentKey: 'purple',
      wallpaperKey: 'default',
      hydrated: false,
      toggleMode: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
      setMode: (m) => set({ mode: m }),
      setAccent: (k) => set({ accentKey: k }),
      setWallpaper: (k) => set({ wallpaperKey: k }),
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
