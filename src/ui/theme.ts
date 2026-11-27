import { useColorScheme } from 'react-native';

import { useData } from '@/data/store';

/** Design tokens — see docs/DESIGN_SYSTEM.md */
const light = {
  bg: '#FFFFFF',
  surface: '#F7F7F8',
  surfaceAlt: '#EFEFF2',
  surfaceHover: '#F1F2F4',
  border: '#E6E6EA',
  borderStrong: '#D2D3D9',
  text: '#16171B',
  textMuted: '#62646E',
  textFaint: '#9A9CA6',
  accent: '#3B5BDB',
  accentText: '#FFFFFF',
  accentSoft: '#E8EDFD',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warning: '#B54708',
  warningSoft: '#FEF4E6',
  nowLine: '#E5484D',
  weekendTint: '#FAFAFB',
  holiday: '#C2410C',
  overlay: 'rgba(16,17,20,0.32)',
  shadow: 'rgba(16,17,20,0.12)',
  eventTextOnTint: '#16171B',
  tintAlpha: 0.16,
};

export type Theme = typeof light;

const dark: Theme = {
  bg: '#101114',
  surface: '#17181C',
  surfaceAlt: '#1F2025',
  surfaceHover: '#1C1D22',
  border: '#2A2B31',
  borderStrong: '#3A3B42',
  text: '#ECECEF',
  textMuted: '#A0A2AB',
  textFaint: '#6C6E78',
  accent: '#7C93FF',
  accentText: '#0D0F1A',
  accentSoft: '#1E2541',
  danger: '#FF6B5E',
  dangerSoft: '#3A1D1B',
  warning: '#F5A524',
  warningSoft: '#33260F',
  nowLine: '#FF6369',
  weekendTint: '#131418',
  holiday: '#FB923C',
  overlay: 'rgba(0,0,0,0.55)',
  shadow: 'rgba(0,0,0,0.5)',
  eventTextOnTint: '#ECECEF',
  tintAlpha: 0.26,
};

export function useTheme(): Theme & { scheme: 'light' | 'dark' } {
  const pref = useData((s) => s.settings.theme);
  const system = useColorScheme();
  const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return scheme === 'dark' ? { ...dark, scheme } : { ...light, scheme };
}

/** Hex color + alpha → rgba() */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 4, md: 6, lg: 8 } as const;

export const font = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

export const text = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const BREAKPOINT = { tablet: 768, desktop: 1100 } as const;
