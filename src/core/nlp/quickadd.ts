/**
 * Rule-based Vietnamese quick-add parser (no AI, no network).
 *
 * "Mai 7h sáng setup loa đài tại nhà khách"
 *   → event, tomorrow 07:00–08:00, title "Setup loa đài", location "nhà khách"
 * "Thứ Hai tuần sau trả video cho khách" → task due next Monday
 * "Ngày 15 âm hằng tháng nhắc tôi"       → all-day event, lunar monthly, reminder
 *
 * Matching runs on an accent-folded copy with a 1:1 character mapping, so every
 * recognized span can be highlighted in (and removed from) the original text.
 * Ambiguities are reported so the UI can ask before saving.
 */
import { lunarOfDayKey, lunarToSolar } from '../lunar/lunar';
import type { Priority } from '../model/types';
import type { Recurrence } from '../recurrence/recurrence';
import { addDays, dayKey, type DayKey, daysInMonth, parseDayKey, weekday } from '../time/days';
import { fold, foldChars } from '../text/normalize';

export type SpanType = 'date' | 'time' | 'recurrence' | 'reminder' | 'calendar' | 'priority' | 'location';

export interface QuickAddResult {
  kind: 'event' | 'task';
  title: string;
  location: string;
  allDay: boolean;
  /** Date of the event / due date of the task (null = no date → Inbox). */
  day: DayKey | null;
  startMin: number | null;
  endMin: number | null;
  recurrence: Recurrence | null;
  /** Minutes before start (0 = at start). */
  reminders: number[];
  calendarId: string | null;
  priority: Priority;
  /** Human-readable notes about guesses the parser made (Vietnamese keys). */
  ambiguous: ('hour-pm-guess' | 'weekday-today' | 'date-rolled-forward')[];
  spans: { start: number; end: number; type: SpanType }[];
}

export interface QuickAddOptions {
  today: DayKey;
  defaultDurationMin?: number;
  calendars?: { id: string; name: string }[];
}

const W = '(?<![\\p{L}\\p{N}])'; // word start
const E = '(?![\\p{L}\\p{N}])'; // word end
const re = (s: string, flags = 'gu') => new RegExp(s, flags);

const WEEKDAY_WORDS: Record<string, number> = {
  '2': 1, hai: 1, '3': 2, ba: 2, '4': 3, tu: 3, '5': 4, nam: 4, '6': 5, sau: 5, '7': 6, bay: 6,
};

const PART = '(sang|trua|chieu|toi|dem)';

export function parseQuickAdd(input: string, opts: QuickAddOptions): QuickAddResult {
  const { original, folded } = foldChars(input);
  const used = new Array<boolean>(original.length).fill(false);
  const spans: QuickAddResult['spans'] = [];
  const ambiguous: QuickAddResult['ambiguous'] = [];
  const free = (a: number, b: number) => used.slice(a, b).every((u) => !u);
  const take = (a: number, b: number, type: SpanType) => {
    for (let i = a; i < b; i++) used[i] = true;
    spans.push({ start: a, end: b, type });
  };
  /** Run a regex over the folded text, calling `fn` for each match on free text. */
  const scan = (rx: RegExp, fn: (m: RegExpExecArray) => SpanType | null) => {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(folded))) {
      const a = m.index;
      const b = a + m[0].length;
      if (m[0].length === 0) {
        rx.lastIndex++;
        continue;
      }
      if (!free(a, b)) continue;
      const type = fn(m);
      if (type) take(a, b, type);
    }
  };

  const today = opts.today;
  let day: DayKey | null = null;
  let dayPart: string | null = null;
  let startMin: number | null = null;
  let endMin: number | null = null;
  let recurrence: Recurrence | null = null;
  const reminders: number[] = [];
  let calendarId: string | null = null;
  let priority: Priority = 0;
  let lunar: { d: number; m: number | null } | null = null;

  // --- reminders: "nhắc (tôi)", "trước 1 ngày và trước 2 tiếng" -------------
  let wantsReminder = false;
  scan(re(`${W}nhac(?: (?:toi|minh|em|anh|chi))?${E}`), () => {
    wantsReminder = true;
    return 'reminder';
  });
  const UNIT: Record<string, number> = { phut: 1, p: 1, tieng: 60, gio: 60, h: 60, ngay: 1440, tuan: 10080 };
  scan(re(`(?:${W}(?:va|,)\\s*)?${W}(?:truoc|som) (\\d{1,3}) ?(phut|p|tieng|gio|h|ngay|tuan)${E}`), (m) => {
    reminders.push(Number(m[1]) * UNIT[m[2]]);
    return 'reminder';
  });
  if (wantsReminder && reminders.length === 0) reminders.push(0);

  // --- recurrence words --------------------------------------------------------
  scan(re(`${W}(?:hang|moi) (ngay|tuan|thang|nam)${E}`), (m) => {
    const f = ({ ngay: 'daily', tuan: 'weekly', thang: 'monthly', nam: 'yearly' } as const)[m[1] as 'ngay'];
    recurrence = { freq: f, interval: 1 };
    return 'recurrence';
  });

  // --- lunar date: "15 âm", "ngày 15/8 âm (lịch)" -----------------------------------
  scan(re(`${W}(?:ngay )?(\\d{1,2})(?:/(\\d{1,2}))? (?:am|al)(?: lich)?${E}`), (m) => {
    const d = Number(m[1]);
    const mo = m[2] ? Number(m[2]) : null;
    if (d < 1 || d > 30 || (mo !== null && (mo < 1 || mo > 12))) return null;
    lunar = { d, m: mo };
    return 'date';
  });

  // --- weekly "mỗi thứ 2" / weekday names ---------------------------------------------------
  const WD = `(?:thu (2|3|4|5|6|7|hai|ba|tu|nam|sau|bay)|t([2-7])|(chu nhat|cn))`;
  scan(re(`${W}moi ${WD}${E}`), (m) => {
    const wd = m[3] ? 0 : WEEKDAY_WORDS[m[1] ?? m[2]];
    recurrence = { freq: 'weekly', interval: 1, byWeekday: [wd] };
    day = upcomingWeekday(today, wd, false);
    return 'recurrence';
  });
  scan(re(`${W}${WD}(?: (tuan (?:sau|toi|nay)))?${E}`), (m) => {
    if (day) return null;
    const wd = m[3] ? 0 : WEEKDAY_WORDS[m[1] ?? m[2]];
    const nextWeek = !!m[4] && !m[4].endsWith('nay');
    day = nextWeek ? addDays(mondayOf(today), 7 + ((wd + 6) % 7)) : upcomingWeekday(today, wd, true);
    if (!nextWeek && wd === weekday(today)) ambiguous.push('weekday-today');
    return 'date';
  });

  // --- relative days --------------------------------------------------------------------------
  scan(re(`${W}(hom nay|hnay|(sang|trua|chieu|toi) nay)${E}`), (m) => {
    if (day) return null;
    day = today;
    if (m[2]) dayPart = m[2];
    return 'date';
  });
  scan(re(`${W}(ngay mai|(sang|trua|chieu|toi) mai)${E}`), (m) => {
    if (day) return null;
    day = addDays(today, 1);
    if (m[2]) dayPart = m[2];
    return 'date';
  });
  // Bare "mai" only at the start or right before a time ("mai 7h"), and never after a person word
  // ("chị Mai", "anh Mai"), so names stay in the title.
  scan(re(`(?<!(?:chi|anh|em|co|chu|bac|ba|ong|ban|be|thay) )(?:^|(?<=\\s))mai(?=\\s+(?:\\d|sang|trua|chieu|toi|luc))|^mai${E}`), () => {
    if (day) return null;
    day = addDays(today, 1);
    return 'date';
  });
  scan(re(`${W}(ngay mot|ngay kia)${E}|^mot(?=\\s+(?:\\d|sang|trua|chieu|toi|luc))`), () => {
    if (day) return null;
    day = addDays(today, 2);
    return 'date';
  });
  scan(re(`${W}cuoi tuan(?: (sau|nay))?${E}`), (m) => {
    if (day) return null;
    const sat = upcomingWeekday(today, 6, true);
    day = m[1] === 'sau' ? addDays(sat, 7) : sat;
    return 'date';
  });
  scan(re(`${W}tuan (sau|toi)${E}`), () => {
    if (day) return null;
    day = addDays(mondayOf(today), 7);
    return 'date';
  });

  // --- explicit dates: "5/12", "05/12/2026", "ngày 15" --------------------------------------
  scan(re(`${W}(?:ngay )?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?${E}`), (m) => {
    if (day) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const { y: ty } = parseDayKey(today);
    let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : ty;
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    if (!m[3] && dayKey(y, mo, d) < today) {
      y += 1;
      ambiguous.push('date-rolled-forward');
    }
    day = dayKey(y, mo, d);
    return 'date';
  });
  scan(re(`${W}ngay (\\d{1,2})${E}(?!\\s*(?:/|am|al))`), (m) => {
    if (day) return null;
    const d = Number(m[1]);
    const { y, m: mo } = parseDayKey(today);
    if (d < 1 || d > 31) return null;
    let cand = d <= daysInMonth(y, mo) ? dayKey(y, mo, d) : null;
    if (!cand || cand < today) {
      const nm = mo === 12 ? 1 : mo + 1;
      const ny = mo === 12 ? y + 1 : y;
      if (d > daysInMonth(ny, nm)) return null;
      cand = dayKey(ny, nm, d);
    }
    day = cand;
    return 'date';
  });

  // --- times: ranges first, then single ----------------------------------------------------
  // "gio" may be spoken with a space ("3 giờ chiều"); "ruoi" = half past ("3 giờ rưỡi").
  const T = `(\\d{1,2})(?:(h|g| ?gio|:)(\\d{2}| ?ruoi)?)?(?: ?(?:p|phut))?`;
  scan(re(`(?:${W}(?:tu|luc|vao) )?${W}${T}(?: ${PART})? ?(?:den|toi|-|–) ?${T}(?: ${PART})?${E}`), (m) => {
    const [, h1, mk1, mi1, p1, h2, mk2, mi2, p2] = m;
    if (!mk1 && !mk2 && !p1 && !p2) return null; // "8-12" without any time marker
    const pEnd = p2 ?? p1 ?? dayPart;
    const s = toMinutes(Number(h1), mi1?.trim() === 'ruoi' ? 30 : Number(mi1 ?? 0), p1 ?? p2 ?? dayPart, ambiguous);
    const e = toMinutes(Number(h2), mi2?.trim() === 'ruoi' ? 30 : Number(mi2 ?? 0), pEnd, ambiguous);
    if (s === null || e === null) return null;
    startMin = s;
    endMin = e > s ? e : e + 720 > s && e + 720 < 1440 ? e + 720 : e;
    return 'time';
  });
  scan(re(`(?:${W}(?:luc|vao) )?${W}(\\d{1,2})(h|g| ?gio|:)(\\d{2}| ?ruoi)?(?: ?(?:p|phut))?(?: ${PART})?${E}`), (m) => {
    if (startMin !== null) return null;
    const s = toMinutes(Number(m[1]), m[3]?.trim() === 'ruoi' ? 30 : Number(m[3] ?? 0), m[4] ?? dayPart, ambiguous);
    if (s === null) return null;
    startMin = s;
    return 'time';
  });
  scan(re(`(?:${W}(?:luc|vao) )?${W}(\\d{1,2}) ${PART}${E}`), (m) => {
    if (startMin !== null) return null;
    const s = toMinutes(Number(m[1]), 0, m[2], ambiguous);
    if (s === null) return null;
    startMin = s;
    return 'time';
  });

  // --- calendar "#media", priority "!3" / "!!!" ----------------------------------------------
  scan(re(`#([\\p{L}\\p{N}_-]+)`), (m) => {
    const key = m[1].replace(/[-_]/g, '');
    const cal = (opts.calendars ?? []).find((c) => fold(c.name).replace(/\s/g, '').includes(key));
    if (!cal) return null;
    calendarId = cal.id;
    return 'calendar';
  });
  scan(re(`(?:^|(?<=\\s))(?:!([1-3])|(!{1,3}))(?=\\s|$)`), (m) => {
    priority = (m[1] ? Number(m[1]) : m[2].length) as Priority;
    return 'priority';
  });

  // --- location: "tại <...>" (exact word "tại" in the original) -------------------------------
  let location = '';
  const tai = /(?<![\p{L}\p{N}])tại(?![\p{L}\p{N}])/giu;
  let lm: RegExpExecArray | null;
  while ((lm = tai.exec(original))) {
    const a = lm.index;
    if (!free(a, a + 3)) continue;
    let b = a + 3;
    while (b < original.length && !used[b]) b++;
    const loc = original.slice(a + 3, b).replace(/[\s,.;]+$/u, '').trim();
    if (loc) {
      location = loc;
      take(a, a + 3 + original.slice(a + 3, b).replace(/[\s,.;]+$/u, '').length, 'location');
    }
    break;
  }

  // --- resolve lunar dates & recurrence --------------------------------------------------------
  const lunarSel = lunar as { d: number; m: number | null } | null;
  const rec = recurrence as Recurrence | null;
  if (lunarSel) {
    if (rec?.freq === 'monthly' || (!rec && lunarSel.m === null)) {
      day = nextLunarDay(today, lunarSel.d, null);
      if (rec) recurrence = { freq: 'lunarMonthly', interval: 1 };
    } else {
      day = nextLunarDay(today, lunarSel.d, lunarSel.m);
      if (rec) recurrence = { freq: 'lunarYearly', interval: 1 };
    }
  }
  if (recurrence && !day) day = today;
  const recNow = recurrence as Recurrence | null;
  if (recNow?.freq === 'weekly' && !recNow.byWeekday && day) recurrence = { ...recNow, byWeekday: [weekday(day)] };

  // --- title -------------------------------------------------------------------------------------
  let title = '';
  for (let i = 0; i < original.length; i++) title += used[i] ? ' ' : original[i];
  title = cleanTitle(title);
  if (!title) title = cleanTitle(original);

  const hasTime = startMin !== null;
  if (hasTime && endMin === null) endMin = Math.min(1439, (startMin as unknown as number) + (opts.defaultDurationMin ?? 60));
  if (hasTime && !day) day = today;
  const kind: QuickAddResult['kind'] = hasTime || recurrence || lunarSel ? 'event' : 'task';

  spans.sort((a, b) => a.start - b.start);
  return {
    kind,
    title,
    location,
    allDay: kind === 'event' && !hasTime,
    day,
    startMin,
    endMin,
    recurrence,
    reminders: [...new Set(reminders)].sort((a, b) => b - a),
    calendarId,
    priority,
    ambiguous: [...new Set(ambiguous)],
    spans,
  };
}

function toMinutes(h: number, mi: number, part: string | null, ambiguous: QuickAddResult['ambiguous']): number | null {
  if (mi > 59 || h > 24) return null;
  let hh = h;
  if (part === 'chieu' || part === 'toi') {
    if (hh < 12) hh += 12;
  } else if (part === 'dem') {
    if (hh === 12) hh = 0;
    else if (hh >= 8 && hh < 12) hh += 12;
  } else if (part === 'trua') {
    if (hh < 3) hh += 12;
  } else if (part === 'sang') {
    if (hh === 12) hh = 0;
  } else if (hh >= 1 && hh <= 5) {
    // "3h" with no part of day: most likely 15:00 for work schedules.
    hh += 12;
    ambiguous.push('hour-pm-guess');
  }
  if (hh === 24) hh = 0;
  return hh * 60 + mi;
}

function mondayOf(d: DayKey): DayKey {
  return addDays(d, -((weekday(d) + 6) % 7));
}

/** Next day with weekday `wd`, today included if `includeToday`. */
function upcomingWeekday(today: DayKey, wd: number, includeToday: boolean): DayKey {
  let diff = (wd - weekday(today) + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(today, diff);
}

/** Next solar day (today included) that is lunar day `d` (of lunar month `m`, if given). */
function nextLunarDay(today: DayKey, d: number, m: number | null): DayKey {
  const l = lunarOfDayKey(today);
  for (let y = l.year; y <= l.year + 2; y++) {
    for (let mo = 1; mo <= 12; mo++) {
      if (m !== null && mo !== m) continue;
      const s = lunarToSolar(d, mo, y, false) ?? lunarToSolar(Math.min(d, 29), mo, y, false);
      if (!s) continue;
      const k = dayKey(s.year, s.month, s.day);
      if (k >= today) return k;
    }
  }
  return today;
}

const EDGE_WORDS = /^(?:lúc|vào|từ|đến|tới|ngày|nhắc|và|cho|với|,|\.|-|–)\s+|\s+(?:lúc|vào|từ|đến|tới|ngày|và|,|\.|-|–)$/iu;

function cleanTitle(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim().replace(/^[,.;:\-–\s]+|[,.;:\-–\s]+$/g, '');
  for (let i = 0; i < 4; i++) t = t.replace(EDGE_WORDS, '').trim();
  t = t.replace(/^[,.;:\-–\s]+|[,.;:\-–\s]+$/g, '');
  return t ? t[0].toLocaleUpperCase('vi') + t.slice(1) : '';
}
