/**
 * Conversion between UTC instants and wall-clock time in an IANA time zone.
 * Uses Intl only (available in browsers and Hermes), no host-zone assumptions.
 */
import { dayKey, type DayKey, parseDayKey } from './days';

export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export interface WallTime {
  day: DayKey;
  /** Minutes since local midnight, 0..1439 */
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

function parts(ms: number, tz: string) {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of `tz` from UTC at instant `ms`, in minutes (e.g. +420 for UTC+7). */
export function zoneOffsetMinutes(ms: number, tz: string): number {
  const p = parts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

export function instantToWall(iso: string | number, tz: string): WallTime {
  const ms = typeof iso === 'number' ? iso : Date.parse(iso);
  const p = parts(ms, tz);
  return { day: dayKey(p.year, p.month, p.day), minutes: p.hour * 60 + p.minute };
}

/** Wall-clock time in `tz` → UTC ISO string. Handles DST gaps by shifting forward. */
export function wallToInstant(day: DayKey, minutes: number, tz: string): string {
  const { y, m, d } = parseDayKey(day);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let ms = guess - zoneOffsetMinutes(guess, tz) * 60000;
  // Second pass for zones whose offset differs at the adjusted instant (DST transitions).
  ms = guess - zoneOffsetMinutes(ms, tz) * 60000;
  return new Date(ms).toISOString();
}

export function nowWall(tz: string): WallTime {
  return instantToWall(Date.now(), tz);
}

export function todayKey(tz: string): DayKey {
  return nowWall(tz).day;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function formatMinutes(minutes: number, format: '24h' | '12h'): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  if (format === '24h') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
