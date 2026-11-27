/**
 * Calendar-day arithmetic on ISO day keys ("YYYY-MM-DD").
 *
 * Day keys are "floating" dates: they carry no time zone. All arithmetic is
 * done in UTC on purpose, so DST or the host machine's zone never shifts a day.
 */

export type DayKey = string;

export function dayKey(y: number, m: number, d: number): DayKey {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDayKey(key: DayKey): { y: number; m: number; d: number } {
  return { y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)), d: Number(key.slice(8, 10)) };
}

function toUtcMs(key: DayKey): number {
  const { y, m, d } = parseDayKey(key);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): DayKey {
  const dt = new Date(ms);
  return dayKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const DAY_MS = 86_400_000;

export function addDays(key: DayKey, n: number): DayKey {
  return fromUtcMs(toUtcMs(key) + n * DAY_MS);
}

export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key: DayKey): number {
  return new Date(toUtcMs(key)).getUTCDay();
}

export function startOfWeek(key: DayKey, weekStart: number): DayKey {
  const wd = weekday(key);
  return addDays(key, -((wd - weekStart + 7) % 7));
}

export function startOfMonth(key: DayKey): DayKey {
  const { y, m } = parseDayKey(key);
  return dayKey(y, m, 1);
}

export function addMonths(key: DayKey, n: number): DayKey {
  const { y, m, d } = parseDayKey(key);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = daysInMonth(ny, nm);
  return dayKey(ny, nm, Math.min(d, last));
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 6 weeks × 7 days covering the month of `key`. */
export function monthGridDays(key: DayKey, weekStart: number): DayKey[] {
  const first = startOfWeek(startOfMonth(key), weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function rangeDays(start: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function isWeekend(key: DayKey): boolean {
  const wd = weekday(key);
  return wd === 0 || wd === 6;
}

export function minDay(a: DayKey, b: DayKey): DayKey {
  return a < b ? a : b;
}

export function maxDay(a: DayKey, b: DayKey): DayKey {
  return a > b ? a : b;
}
