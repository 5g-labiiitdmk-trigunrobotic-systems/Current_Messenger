import { useMemo } from 'react';
import { useThemeStore } from '../state/themeStore';
import { themes, accentPalettes } from './tokens';

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const accentKey = useThemeStore((s) => s.accentKey);
  const toggleMode = useThemeStore((s) => s.toggleMode);

  return useMemo(() => {
    const t = themes[mode];
    const [a1, a2] = accentPalettes[accentKey];
    return { mode, tokens: t, a1, a2, toggleMode, isLight: mode === 'light' };
  }, [mode, accentKey, toggleMode]);
}

export type ThemeContextValue = ReturnType<typeof useTheme>;
