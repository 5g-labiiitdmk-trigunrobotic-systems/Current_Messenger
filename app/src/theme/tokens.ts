// Design tokens ported 1:1 from the Claude Design export (Current.dc.html).
// Every color/opacity value below matches the `--` custom properties in that file.

export type Mode = 'light' | 'dark';

export const accent = { a1: '#7c5cff', a2: '#5b3ddf' };

export type AccentKey = 'purple' | 'blue' | 'pink' | 'green';

export const accentPalettes: Record<AccentKey, [string, string]> = {
  purple: ['#7c5cff', '#5b3ddf'],
  blue: ['#2db4ff', '#1a6ff0'],
  pink: ['#ff6a8f', '#e0357a'],
  green: ['#34d2a0', '#0f9d7a'],
};

export const success = '#34d27b';
export const successDark = '#15a55c';
export const danger = '#ff5a6e';
export const dangerDark = '#e0354b';

export interface ThemeTokens {
  wallStops: string[]; // linear gradient stops approximating the CSS `--wall` background
  wallAngle: number; // degrees
  orbColor: string;
  /** Solid elevation-tone surfaces (Material 3 dark-theme convention: depth
   * from flat tone difference, not blur/shadow). glassBg = standard card
   * level, glassBg2 = elevated/active level (tab bar, pressed states),
   * field = recessed level (inputs). Names kept from the earlier
   * translucent-glass tokens to minimize churn at call sites — values are
   * now opaque hex, not rgba. */
  glassBg: string;
  glassBg2: string;
  glassBorder: string; // hairline outline, alpha kept — blends into whatever's behind the card edge
  text: string;
  text2: string;
  text3: string;
  ring: string;
  tabBg: string; // solid tone the bottom scroll-under fade settles into (matches glassBg2)
  field: string;
  glowColor: string; // soft text shadow color
  statusBarStyle: 'dark' | 'light';
}

export const themes: Record<Mode, ThemeTokens> = {
  light: {
    wallStops: ['#b7b4ea', '#c8c1e6', '#e8d7c6', '#f6d7a0'],
    wallAngle: 118,
    orbColor: 'rgba(255,216,150,0.9)',
    glassBg: '#f7f6fb',
    glassBg2: '#ffffff',
    glassBorder: 'rgba(255,255,255,0.82)',
    text: '#1c1830',
    text2: 'rgba(34,28,60,0.78)',
    text3: 'rgba(34,28,60,0.58)',
    ring: 'rgba(255,255,255,0.8)',
    tabBg: '#ffffff',
    field: '#eeedf5',
    glowColor: 'rgba(255,255,255,0.5)',
    statusBarStyle: 'dark',
  },
  dark: {
    wallStops: ['#08080a', '#0e0e12', '#08080a'],
    wallAngle: 140,
    orbColor: 'rgba(150,150,168,0.16)',
    glassBg: '#19191d',
    glassBg2: '#232328',
    glassBorder: 'rgba(255,255,255,0.22)',
    text: '#f3f2f8',
    text2: 'rgba(235,233,245,0.6)',
    text3: 'rgba(235,233,245,0.38)',
    ring: 'rgba(16,16,20,0.85)',
    tabBg: '#232328',
    field: '#121216',
    glowColor: 'rgba(0,0,0,0.55)',
    statusBarStyle: 'light',
  },
};

export const radii = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 26,
  xxl: 30,
  pill: 999,
};

export const spacing = (n: number) => n * 4;

export const fontWeights = {
  regular: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
  black: '900' as const,
};

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
};

export function fontFamily(weight: number): string {
  if (weight >= 900) return fontFamilies.black;
  if (weight >= 800) return fontFamilies.heavy;
  if (weight >= 700) return fontFamilies.bold;
  if (weight >= 600) return fontFamilies.semibold;
  if (weight >= 500) return fontFamilies.medium;
  return fontFamilies.regular;
}

// Deterministic avatar gradient generator — mirrors `av(h)` in the original component logic.
export function avatarGradient(hue: number): [string, string] {
  return [hslToHex(hue, 72, 72), hslToHex(hue + 38, 62, 52)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
