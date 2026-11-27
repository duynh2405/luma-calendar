import { useCallback } from 'react';

import { canChiDay, canChiMonth, canChiYear } from '@/core/lunar/canchi';
import type { LunarDate } from '@/core/lunar/lunar';
import type { Locale } from '@/core/model/types';
import { type DayKey, parseDayKey, weekday } from '@/core/time/days';
import { useData } from '@/data/store';

import { MONTH_LONG, STRINGS, type StringKey, WEEKDAY_LONG, WEEKDAY_SHORT } from './strings';

export type T = (key: StringKey, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = STRINGS[locale][key] ?? STRINGS.vi[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function useT(): T {
  const locale = useData((s) => s.settings.locale);
  return useCallback<T>((key, vars) => translate(locale, key, vars), [locale]);
}

export function useLocale(): Locale {
  return useData((s) => s.settings.locale);
}

// --- Date formatting ---------------------------------------------------------

export function weekdayShort(locale: Locale, day: DayKey): string {
  return WEEKDAY_SHORT[locale][weekday(day)];
}

export function formatMonthYear(locale: Locale, day: DayKey): string {
  const { y, m } = parseDayKey(day);
  return locale === 'vi' ? `Tháng ${m}, ${y}` : `${MONTH_LONG.en[m - 1]} ${y}`;
}

export function formatLongDate(locale: Locale, day: DayKey): string {
  const { y, m, d } = parseDayKey(day);
  const wd = WEEKDAY_LONG[locale][weekday(day)];
  return locale === 'vi' ? `${wd}, ${d} tháng ${m}, ${y}` : `${wd}, ${MONTH_LONG.en[m - 1]} ${d}, ${y}`;
}

export function formatShortDate(locale: Locale, day: DayKey): string {
  const { y, m, d } = parseDayKey(day);
  const wd = WEEKDAY_SHORT[locale][weekday(day)];
  return locale === 'vi' ? `${wd}, ${d}/${m}/${y}` : `${wd}, ${MONTH_LONG.en[m - 1].slice(0, 3)} ${d}, ${y}`;
}

/** Compact lunar label for calendar cells: "19", or "1/10" on the first day, "1/6N" in a leap month. */
export function lunarCellLabel(l: LunarDate): string {
  if (l.day === 1) return `${l.day}/${l.month}${l.leap ? 'N' : ''}`;
  return String(l.day);
}

export function lunarFullLabel(t: T, l: LunarDate): string {
  return t('lunarDayOf', { d: l.day, m: l.month, leap: l.leap ? t('leapSuffix') : '', y: canChiYear(l.year) });
}

export function canChiLine(t: T, day: DayKey, l: LunarDate): string {
  const { y, m, d } = parseDayKey(day);
  return [
    t('canChiDay', { v: canChiDay(d, m, y) }),
    t('canChiMonth', { v: canChiMonth(l.month, l.year) }),
    t('canChiYear', { v: canChiYear(l.year) }),
  ].join(', ');
}
