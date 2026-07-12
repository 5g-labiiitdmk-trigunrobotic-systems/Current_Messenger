export interface Pool {
  cx: number; // 0-1
  cy: number; // 0-1
  r: number; // 0-1 of max dimension
  color: string;
}

interface WallpaperVariant {
  wallStops: string[];
  pools: Pool[];
  orbColor: string;
}

export interface WallpaperDef {
  label: string;
  swatch: [string, string]; // preview gradient for the picker
  light: WallpaperVariant;
  dark: WallpaperVariant;
}

export type WallpaperKey = 'default' | 'ocean' | 'sunset' | 'forest' | 'midnight' | 'aurora' | 'rose' | 'slate';

export const wallpapers: Record<WallpaperKey, WallpaperDef> = {
  default: {
    label: 'Default',
    swatch: ['#c8c1e6', '#f6d7a0'],
    light: {
      wallStops: ['#b7b4ea', '#c8c1e6', '#e8d7c6', '#f6d7a0'],
      orbColor: 'rgba(255,216,150,0.9)',
      pools: [
        { cx: 0.86, cy: 0.24, r: 0.34, color: 'rgba(255,224,158,0.95)' },
        { cx: 0.74, cy: 0.52, r: 0.28, color: 'rgba(255,198,132,0.85)' },
        { cx: 0.96, cy: 0.78, r: 0.32, color: 'rgba(255,214,150,0.7)' },
        { cx: 0.1, cy: 0.26, r: 0.38, color: 'rgba(178,170,238,0.9)' },
        { cx: 0.02, cy: 0.78, r: 0.38, color: 'rgba(150,166,232,0.78)' },
      ],
    },
    dark: {
      wallStops: ['#08080a', '#0e0e12', '#08080a'],
      orbColor: 'rgba(150,150,168,0.16)',
      pools: [
        { cx: 0.8, cy: 0.22, r: 0.36, color: 'rgba(150,150,165,0.22)' },
        { cx: 0.16, cy: 0.72, r: 0.36, color: 'rgba(120,120,138,0.18)' },
        { cx: 0.5, cy: 0.5, r: 0.55, color: 'rgba(90,90,104,0.12)' },
      ],
    },
  },
  ocean: {
    label: 'Ocean',
    swatch: ['#a8d8ea', '#3d7ea6'],
    light: {
      wallStops: ['#c3e8f2', '#a8d8ea', '#7fb8d6', '#4f8fb0'],
      orbColor: 'rgba(150,220,240,0.85)',
      pools: [
        { cx: 0.88, cy: 0.2, r: 0.34, color: 'rgba(180,235,245,0.9)' },
        { cx: 0.7, cy: 0.55, r: 0.3, color: 'rgba(120,195,220,0.75)' },
        { cx: 0.08, cy: 0.28, r: 0.36, color: 'rgba(140,200,225,0.8)' },
        { cx: 0.04, cy: 0.8, r: 0.36, color: 'rgba(80,150,190,0.65)' },
      ],
    },
    dark: {
      wallStops: ['#050a10', '#081420', '#050a10'],
      orbColor: 'rgba(100,170,210,0.2)',
      pools: [
        { cx: 0.82, cy: 0.24, r: 0.36, color: 'rgba(70,140,180,0.24)' },
        { cx: 0.14, cy: 0.7, r: 0.36, color: 'rgba(50,110,150,0.2)' },
        { cx: 0.5, cy: 0.48, r: 0.55, color: 'rgba(40,90,120,0.14)' },
      ],
    },
  },
  sunset: {
    label: 'Sunset',
    swatch: ['#ffb98a', '#e0578f'],
    light: {
      wallStops: ['#ffd9ae', '#ffb98a', '#ff8fa3', '#d888d6'],
      orbColor: 'rgba(255,200,170,0.9)',
      pools: [
        { cx: 0.85, cy: 0.22, r: 0.34, color: 'rgba(255,210,160,0.9)' },
        { cx: 0.72, cy: 0.5, r: 0.3, color: 'rgba(255,150,170,0.8)' },
        { cx: 0.06, cy: 0.3, r: 0.36, color: 'rgba(255,180,150,0.8)' },
        { cx: 0.02, cy: 0.8, r: 0.38, color: 'rgba(220,140,210,0.7)' },
      ],
    },
    dark: {
      wallStops: ['#160810', '#240a16', '#160810'],
      orbColor: 'rgba(220,110,140,0.2)',
      pools: [
        { cx: 0.8, cy: 0.2, r: 0.36, color: 'rgba(200,90,110,0.22)' },
        { cx: 0.16, cy: 0.72, r: 0.36, color: 'rgba(160,70,120,0.18)' },
        { cx: 0.5, cy: 0.5, r: 0.55, color: 'rgba(120,60,90,0.12)' },
      ],
    },
  },
  forest: {
    label: 'Forest',
    swatch: ['#bfe3b4', '#4c9a63'],
    light: {
      wallStops: ['#daf0d0', '#bfe3b4', '#9ed6a8', '#6fb98a'],
      orbColor: 'rgba(200,235,190,0.9)',
      pools: [
        { cx: 0.86, cy: 0.24, r: 0.34, color: 'rgba(210,240,190,0.9)' },
        { cx: 0.72, cy: 0.54, r: 0.28, color: 'rgba(160,215,170,0.8)' },
        { cx: 0.08, cy: 0.28, r: 0.36, color: 'rgba(190,225,180,0.8)' },
        { cx: 0.02, cy: 0.8, r: 0.38, color: 'rgba(130,190,150,0.7)' },
      ],
    },
    dark: {
      wallStops: ['#05100a', '#0a1a10', '#05100a'],
      orbColor: 'rgba(100,180,130,0.18)',
      pools: [
        { cx: 0.8, cy: 0.22, r: 0.36, color: 'rgba(70,150,100,0.2)' },
        { cx: 0.16, cy: 0.72, r: 0.36, color: 'rgba(50,120,80,0.18)' },
        { cx: 0.5, cy: 0.5, r: 0.55, color: 'rgba(40,95,65,0.12)' },
      ],
    },
  },
  midnight: {
    label: 'Midnight',
    swatch: ['#2a2a3a', '#0a0a12'],
    light: {
      // "Midnight" is deliberately subdued in light mode too — a low-color,
      // near-monochrome option for users who find the default too busy.
      wallStops: ['#d8d8e0', '#c4c4d2', '#b0b0c2', '#9a9ab0'],
      orbColor: 'rgba(190,190,210,0.7)',
      pools: [
        { cx: 0.82, cy: 0.24, r: 0.34, color: 'rgba(210,210,225,0.6)' },
        { cx: 0.14, cy: 0.72, r: 0.36, color: 'rgba(180,180,200,0.5)' },
      ],
    },
    dark: {
      wallStops: ['#020203', '#050507', '#020203'],
      orbColor: 'rgba(120,120,140,0.12)',
      pools: [
        { cx: 0.8, cy: 0.22, r: 0.36, color: 'rgba(80,80,95,0.14)' },
        { cx: 0.16, cy: 0.72, r: 0.36, color: 'rgba(60,60,75,0.1)' },
      ],
    },
  },
  aurora: {
    label: 'Aurora',
    swatch: ['#8ed1c9', '#9a7fd4'],
    light: {
      wallStops: ['#a8e6d5', '#8ed1e0', '#a390d9', '#d896c9'],
      orbColor: 'rgba(150,225,205,0.9)',
      pools: [
        { cx: 0.86, cy: 0.22, r: 0.34, color: 'rgba(160,230,215,0.9)' },
        { cx: 0.7, cy: 0.52, r: 0.3, color: 'rgba(150,190,225,0.8)' },
        { cx: 0.08, cy: 0.28, r: 0.36, color: 'rgba(165,150,220,0.8)' },
        { cx: 0.04, cy: 0.8, r: 0.36, color: 'rgba(210,150,200,0.7)' },
      ],
    },
    dark: {
      wallStops: ['#050c0a', '#0a1018', '#050c0a'],
      orbColor: 'rgba(100,190,175,0.2)',
      pools: [
        { cx: 0.82, cy: 0.22, r: 0.36, color: 'rgba(70,170,150,0.2)' },
        { cx: 0.16, cy: 0.7, r: 0.36, color: 'rgba(100,90,160,0.18)' },
        { cx: 0.5, cy: 0.5, r: 0.55, color: 'rgba(60,110,120,0.12)' },
      ],
    },
  },
  rose: {
    label: 'Rose',
    swatch: ['#ffb3c1', '#e0607a'],
    light: {
      wallStops: ['#ffd6db', '#ffb3c1', '#ff8fa8', '#e0607a'],
      orbColor: 'rgba(255,185,198,0.9)',
      pools: [
        { cx: 0.86, cy: 0.24, r: 0.34, color: 'rgba(255,205,213,0.9)' },
        { cx: 0.72, cy: 0.52, r: 0.28, color: 'rgba(255,160,180,0.8)' },
        { cx: 0.08, cy: 0.28, r: 0.36, color: 'rgba(255,180,190,0.8)' },
        { cx: 0.02, cy: 0.8, r: 0.38, color: 'rgba(224,140,155,0.7)' },
      ],
    },
    dark: {
      wallStops: ['#140508', '#20080c', '#140508'],
      orbColor: 'rgba(200,90,115,0.2)',
      pools: [
        { cx: 0.8, cy: 0.2, r: 0.36, color: 'rgba(180,70,95,0.22)' },
        { cx: 0.16, cy: 0.72, r: 0.36, color: 'rgba(140,55,80,0.18)' },
        { cx: 0.5, cy: 0.5, r: 0.55, color: 'rgba(100,45,60,0.12)' },
      ],
    },
  },
  slate: {
    label: 'Slate',
    swatch: ['#c3ccd6', '#8291a3'],
    light: {
      // A cool, muted, low-color option in the same spirit as Midnight but
      // blue-leaning rather than near-monochrome — for a calmer, more
      // "professional" feel than the default's warm purple/orange.
      wallStops: ['#dfe4ea', '#c3ccd6', '#a3b0bf', '#8291a3'],
      orbColor: 'rgba(190,205,220,0.75)',
      pools: [
        { cx: 0.84, cy: 0.24, r: 0.34, color: 'rgba(205,215,228,0.7)' },
        { cx: 0.7, cy: 0.54, r: 0.28, color: 'rgba(170,190,208,0.6)' },
        { cx: 0.08, cy: 0.28, r: 0.36, color: 'rgba(185,198,212,0.65)' },
      ],
    },
    dark: {
      wallStops: ['#08090c', '#0c0f14', '#08090c'],
      orbColor: 'rgba(110,125,145,0.16)',
      pools: [
        { cx: 0.8, cy: 0.22, r: 0.36, color: 'rgba(90,105,125,0.18)' },
        { cx: 0.16, cy: 0.72, r: 0.36, color: 'rgba(70,85,105,0.14)' },
        { cx: 0.5, cy: 0.5, r: 0.55, color: 'rgba(55,65,80,0.1)' },
      ],
    },
  },
};
