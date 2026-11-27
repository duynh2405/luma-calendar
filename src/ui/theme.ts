import { useColorScheme } from 'react-native';

import { useData } from '@/data/store';

/** Design tokens — see docs/DESIGN_SYSTEM.md */
const light = {
  bg: '#FDFCFA',
  surface: '#F8F6F2',
  surfaceAlt: '#F1EEE8',
  surfaceHover: '#F4F1EB',
  border: '#ECE8E0',
  borderStrong: '#DCD7CC',
  text: '#26231F',
  textMuted: '#6B665D',
  textFaint: '#A19B90',
  accent: '#4A5BB5',
  accentText: '#FFFFFF',
  accentSoft: '#E9ECF8',
  danger: '#C2392B',
  dangerSoft: '#FBEDEA',
  warning: '#A8661A',
  warningSoft: '#FBF2E3',
  nowLine: '#C8514A',
  weekendTint: '#FAF8F4',
  holiday: '#B5472F',
  lunar: '#A07A3C',
  overlay: 'rgba(30,26,20,0.30)',
  shadow: 'rgba(30,26,20,0.10)',
  eventTextOnTint: '#26231F',
  tintAlpha: 0.16,
};

export type Theme = typeof light;

const dark: Theme = {
  bg: '#131211',
  surface: '#1A1917',
  surfaceAlt: '#22211E',
  surfaceHover: '#1E1D1B',
  border: '#2B2926',
  borderStrong: '#3A3733',
  text: '#EDEAE4',
  textMuted: '#A8A399',
  textFaint: '#76726A',
  accent: '#9DA8EA',
  accentText: '#14151F',
  accentSoft: '#23263D',
  danger: '#F28B7E',
  dangerSoft: '#3A211E',
  warning: '#E0A44A',
  warningSoft: '#33281A',
  nowLine: '#E8776F',
  weekendTint: '#161513',
  holiday: '#E8946F',
  lunar: '#D2B27A',
  overlay: 'rgba(0,0,0,0.55)',
  shadow: 'rgba(0,0,0,0.5)',
  eventTextOnTint: '#EDEAE4',
  tintAlpha: 0.24,
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
export const radius = { sm: 5, md: 8, lg: 12 } as const;

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
