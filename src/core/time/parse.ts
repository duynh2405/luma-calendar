/**
 * Lenient parsing of typed times and dates (Vietnamese-friendly).
 * Times:  "7", "7h", "7h30", "07:30", "730", "19.30", "7:30 pm", "7h tối", "2 chiều"
 * Dates:  "25/11", "25/11/2026", "25-11-26", "2026-11-25"
 */
import { dayKey, type DayKey, daysInMonth, parseDayKey } from './days';

/** Returns minutes since midnight, or null if not understood. */
export function parseTimeText(input: string): number | null {
  const s = input
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ');
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?:\s*(?:h|g|giờ|:|\.)\s*(\d{1,2})?)?\s*(?:p|phút)?\s*(am|pm|a|p|sáng|trưa|chiều|tối|đêm)?$/u);
  let h: number;
  let min: number;
  let suffix: string | undefined;
  if (m) {
    h = Number(m[1]);
    min = m[2] ? Number(m[2]) : 0;
    suffix = m[3];
  } else {
    const compact = s.match(/^(\d{3,4})\s*(am|pm|sáng|chiều|tối)?$/u);
    if (!compact) return null;
    const digits = compact[1].padStart(4, '0');
    h = Number(digits.slice(0, 2));
    min = Number(digits.slice(2));
    suffix = compact[2];
  }
  if (suffix === 'pm' || suffix === 'p' || suffix === 'chiều' || suffix === 'tối') {
    if (h < 12) h += 12;
  } else if (suffix === 'am' || suffix === 'a' || suffix === 'sáng') {
    if (h === 12) h = 0;
  } else if (suffix === 'đêm') {
    if (h === 12) h = 0;
    else if (h >= 8 && h < 12) h += 12;
  } else if (suffix === 'trưa') {
    if (h < 3) h += 12;
  }
  if (h === 24 && min === 0) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Returns a day key, or null. Missing year → `refDay`'s year. Day-first order (dd/mm). */
export function parseDateText(input: string, refDay: DayKey): DayKey | null {
  const s = input.trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number;
  let m: number;
  let d: number;
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const dm = s.match(/^(\d{1,2})[/.\-\s](\d{1,2})(?:[/.\-\s](\d{2}|\d{4}))?$/);
    if (!dm) return null;
    d = Number(dm[1]);
    m = Number(dm[2]);
    y = dm[3] ? Number(dm[3]) : parseDayKey(refDay).y;
    if (dm[3] && dm[3].length === 2) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2199 || d > daysInMonth(y, m)) return null;
  return dayKey(y, m, d);
}

export function formatDayKeyVi(day: DayKey): string {
  const { y, m, d } = parseDayKey(day);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
