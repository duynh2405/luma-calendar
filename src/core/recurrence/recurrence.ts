/**
 * Recurrence rules and expansion.
 *
 * Solar rules follow RFC 5545 semantics for the supported subset
 * (FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, BYDAY, BYMONTHDAY, BYSETPOS-like
 * "nth weekday", UNTIL, COUNT). Lunar rules are our own extension (RRULE can't
 * express them): they repeat on a Vietnamese lunar day.
 *
 * Rules operate on *day keys* (the occurrence's date in the event's own zone);
 * the wall-clock time of the first occurrence is kept for every occurrence.
 *
 * Lunar edge cases (documented in docs/PRODUCT_SPEC.md):
 *  - Day 30 in a 29-day month → the last day (29).
 *  - lunarYearly: only the regular (non-leap) month, unless leapMode = 'both'.
 *    A series that started in a leap month repeats in the regular month of that number.
 *  - lunarMonthly: every lunar month including leap months, unless leapMode = 'regularOnly'.
 */
import { jdToDate, leapMonthOfYear, lunarMonthLength, lunarMonthStartJd, lunarOfDayKey } from '../lunar/lunar';
import { addDays, addMonths, dayKey, type DayKey, daysInMonth, diffDays, parseDayKey, weekday } from '../time/days';

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lunarMonthly' | 'lunarYearly';

export interface Recurrence {
  freq: Freq;
  /** every N periods (≥ 1) */
  interval: number;
  /** weekly: weekdays 0 (Sun) … 6 (Sat); empty/undefined = weekday of the start */
  byWeekday?: number[];
  /** monthly: same day of month (default) or same "nth weekday" (e.g. 2nd Tuesday, or last Friday) */
  monthlyMode?: 'dayOfMonth' | 'nthWeekday';
  /** lunar rules: include leap months or not */
  leapMode?: 'regularOnly' | 'both';
  /** last allowed occurrence day (inclusive) */
  until?: DayKey | null;
  /** total number of occurrences (including excluded ones, as in RFC 5545) */
  count?: number | null;
}

const MAX_ITER = 20000;

/**
 * Occurrence days of a series starting at `start`, within [from, to] (inclusive).
 * Excluded days are not removed here (the caller applies exdates/overrides).
 */
export function occurrenceDays(start: DayKey, rule: Recurrence, from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  const until = rule.until && rule.until < to ? rule.until : to;
  if (until < start) return out;
  let n = 0; // occurrence index (for COUNT)
  const push = (d: DayKey) => {
    n++;
    if (rule.count && n > rule.count) return false;
    if (d > until) return false;
    if (d >= from) out.push(d);
    return true;
  };
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const { y: sy, m: sm, d: sd } = parseDayKey(start);

  switch (rule.freq) {
    case 'daily': {
      // Jump close to `from` when COUNT doesn't need exact indices.
      let i = 0;
      if (!rule.count && from > start) i = Math.floor(diffDays(from, start) / interval);
      for (let k = 0; k < MAX_ITER; k++, i++) {
        if (!push(addDays(start, i * interval))) break;
      }
      break;
    }
    case 'weekly': {
      const days = (rule.byWeekday?.length ? [...rule.byWeekday] : [weekday(start)]).sort((a, b) => a - b);
      // Weeks start on Monday for interval arithmetic (RFC default WKST=MO).
      const weekStartOf = (d: DayKey) => addDays(d, -((weekday(d) + 6) % 7));
      const firstWeek = weekStartOf(start);
      let w = 0;
      if (!rule.count && from > start) w = Math.floor(diffDays(weekStartOf(from), firstWeek) / 7 / interval);
      outer: for (let k = 0; k < MAX_ITER; k++, w++) {
        const ws = addDays(firstWeek, w * 7 * interval);
        for (const wd of days.map((x) => (x + 6) % 7).sort((a, b) => a - b)) {
          const d = addDays(ws, wd);
          if (d < start) continue;
          if (!push(d)) break outer;
        }
      }
      break;
    }
    case 'monthly': {
      const nth = nthWeekdayOf(start);
      for (let k = 0, i = 0; k < MAX_ITER; k++, i++) {
        const base = addMonths(dayKey(sy, sm, 1), i * interval);
        const { y, m } = parseDayKey(base);
        let d: DayKey | null;
        if (rule.monthlyMode === 'nthWeekday') d = nthWeekdayIn(y, m, weekday(start), nth);
        else d = sd <= daysInMonth(y, m) ? dayKey(y, m, sd) : null; // RFC: skip months without that day
        if (d === null) {
          if (base > until) break;
          continue;
        }
        if (!push(d)) break;
      }
      break;
    }
    case 'yearly': {
      for (let k = 0, i = 0; k < MAX_ITER; k++, i++) {
        const y = sy + i * interval;
        if (dayKey(y, 1, 1) > until) break;
        if (sd > daysInMonth(y, sm)) continue; // Feb 29 only in leap years
        if (!push(dayKey(y, sm, sd))) break;
      }
      break;
    }
    case 'lunarMonthly':
    case 'lunarYearly': {
      const l = lunarOfDayKey(start);
      const includeLeap = rule.freq === 'lunarMonthly' ? rule.leapMode !== 'regularOnly' : rule.leapMode === 'both';
      let idx = 0; // counts eligible months, for interval
      for (let y = l.year; y < l.year + 400; y++) {
        if (dayKey(y - 1, 12, 1) > until) break;
        const leapM = leapMonthOfYear(y);
        const months: Array<{ m: number; leap: boolean }> = [];
        for (let m = 1; m <= 12; m++) {
          months.push({ m, leap: false });
          if (leapM === m) months.push({ m, leap: true });
        }
        let stop = false;
        for (const mo of months) {
          if (rule.freq === 'lunarYearly' && mo.m !== l.month) continue;
          if (mo.leap && !includeLeap) continue;
          const startJd = lunarMonthStartJd(mo.m, y, mo.leap);
          if (startJd === null) continue;
          const len = lunarMonthLength(mo.m, y, mo.leap) ?? 30;
          const s = jdToDate(startJd + Math.min(l.day, len) - 1);
          const d = dayKey(s.year, s.month, s.day);
          if (d < start) continue;
          const eligible = idx++ % interval === 0;
          if (!eligible) continue;
          if (!push(d)) {
            stop = true;
            break;
          }
        }
        if (stop) break;
      }
      break;
    }
  }
  return out;
}

/** 1..4 for the first four weeks, -1 when the day is in the last 7 days of its month. */
export function nthWeekdayOf(day: DayKey): number {
  const { y, m, d } = parseDayKey(day);
  if (d + 7 > daysInMonth(y, m)) return -1;
  return Math.floor((d - 1) / 7) + 1;
}

function nthWeekdayIn(y: number, m: number, wd: number, nth: number): DayKey | null {
  if (nth === -1) {
    const last = daysInMonth(y, m);
    const lastWd = weekday(dayKey(y, m, last));
    return dayKey(y, m, last - ((lastWd - wd + 7) % 7));
  }
  const firstWd = weekday(dayKey(y, m, 1));
  const d = 1 + ((wd - firstWd + 7) % 7) + (nth - 1) * 7;
  return d <= daysInMonth(y, m) ? dayKey(y, m, d) : null;
}

/** Next occurrence day strictly after `after` (used for recurring tasks). */
export function nextOccurrence(start: DayKey, rule: Recurrence, after: DayKey): DayKey | null {
  // Look ahead up to ~13 months per step of the rule's natural period.
  const horizon = rule.freq === 'yearly' || rule.freq === 'lunarYearly' ? 366 * Math.max(1, rule.interval) + 31 : 400;
  const days = occurrenceDays(start, rule, addDays(after, 1), addDays(after, horizon));
  return days[0] ?? null;
}

/** RFC 5545 RRULE string for export (lunar rules can't be expressed → null). */
export function toRRule(rule: Recurrence, start: DayKey): string | null {
  const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const parts: string[] = [];
  switch (rule.freq) {
    case 'daily':
      parts.push('FREQ=DAILY');
      break;
    case 'weekly':
      parts.push('FREQ=WEEKLY', `BYDAY=${(rule.byWeekday?.length ? rule.byWeekday : [weekday(start)]).map((d) => WD[d]).join(',')}`);
      break;
    case 'monthly':
      parts.push('FREQ=MONTHLY');
      if (rule.monthlyMode === 'nthWeekday') parts.push(`BYDAY=${nthWeekdayOf(start)}${WD[weekday(start)]}`);
      break;
    case 'yearly':
      parts.push('FREQ=YEARLY');
      break;
    default:
      return null;
  }
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  else if (rule.until) parts.push(`UNTIL=${rule.until.replace(/-/g, '')}`);
  return parts.join(';');
}

export function isLunarRule(rule: Recurrence | null | undefined): boolean {
  return rule?.freq === 'lunarMonthly' || rule?.freq === 'lunarYearly';
}
