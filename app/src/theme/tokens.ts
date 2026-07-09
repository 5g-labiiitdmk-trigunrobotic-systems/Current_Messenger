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
  glassBg: string; // --g-bg
  glassBg2: string; // --g-bg2
  glassBorder: string; // --g-bd
  text: string; // --txt
  text2: string; // --txt2
  text3: string; // --txt3
  ring: string; // --ring
  tabBg: string; // --tab-bg
  field: string; // --field
  glowColor: string; // soft text shadow color
  statusBarStyle: 'dark' | 'light';
  bevelHighlight: string;
  bevelShadow: string;
}

export const themes: Record<Mode, ThemeTokens> = {
  light: {
    wallStops: ['#b7b4ea', '#c8c1e6', '#e8d7c6', '#f6d7a0'],
    wallAngle: 118,
    orbColor: 'rgba(255,216,150,0.9)',
    glassBg: 'rgba(255,255,255,0.10)',
    glassBg2: 'rgba(255,255,255,0.20)',
    glassBorder: 'rgba(255,255,255,0.82)',
    text: '#1c1830',
    text2: 'rgba(34,28,60,0.64)',
    text3: 'rgba(34,28,60,0.42)',
    ring: 'rgba(255,255,255,0.8)',
    tabBg: 'rgba(255,255,255,0.5)',
    field: 'rgba(255,255,255,0.28)',
    glowColor: 'rgba(255,255,255,0.5)',
    statusBarStyle: 'dark',
    bevelHighlight: 'rgba(255,255,255,0.95)',
    bevelShadow: 'rgba(60,40,90,0.14)',
  },
  dark: {
    wallStops: ['#08080a', '#0e0e12', '#08080a'],
    wallAngle: 140,
    orbColor: 'rgba(150,150,168,0.16)',
    glassBg: 'rgba(255,255,255,0.04)',
    glassBg2: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.22)',
    text: '#f3f2f8',
    text2: 'rgba(235,233,245,0.6)',
    text3: 'rgba(235,233,245,0.38)',
    ring: 'rgba(16,16,20,0.85)',
    tabBg: 'rgba(38,38,44,0.5)',
    field: 'rgba(255,255,255,0.05)',
    glowColor: 'rgba(0,0,0,0.55)',
    statusBarStyle: 'light',
    bevelHighlight: 'rgba(255,255,255,0.28)',
    bevelShadow: 'rgba(0,0,0,0.5)',
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
