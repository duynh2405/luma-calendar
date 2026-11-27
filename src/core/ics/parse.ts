/**
 * ICS (RFC 5545) reader: turns an .ics text into Luma events.
 * Pure TS. Supported: VEVENT (all-day / timed / floating / TZID / Z), DURATION, RRULE subset
 * (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, BYDAY, nth weekday, UNTIL, COUNT), EXDATE,
 * RECURRENCE-ID overrides, VALARM (relative triggers → reminders), STATUS:CANCELLED skipped.
 * Ids are derived from the UID, so importing the same file again updates instead of duplicating.
 */
import type { CalendarEvent } from '../model/types';
import type { Recurrence } from '../recurrence/recurrence';
import { addDays, dayKey, type DayKey, parseDayKey, weekday } from '../time/days';
import { instantToWall, wallToInstant } from '../time/zone';

export interface IcsResult {
  events: CalendarEvent[];
  calendarName: string | null;
  stats: { events: number; recurring: number; overrides: number; skipped: number; approximated: number };
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): Prop | null {
  // name[;param=value]*:value  (param values may be quoted and contain ':')
  let i = 0;
  let inQuote = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) break;
  }
  if (i >= line.length) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts: string[] = [];
  let cur = '';
  inQuote = false;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    if (c === ';' && !inQuote) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: parts[0].toUpperCase(), params, value };
}

export function unescapeText(s: string): string {
  return s.replace(/\\([nN])/g, '\n').replace(/\\([,;\\])/g, '$1');
}

function validZone(tz: string | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

interface When {
  allDay: boolean;
  day: DayKey;
  minutes: number;
  /** Set for UTC ("Z") values. */
  utcMs?: number;
  zone: string | null;
}

function parseWhen(p: Prop): When | null {
  const v = p.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const day = dayKey(Number(m[1]), Number(m[2]), Number(m[3]));
  if (m[4] === undefined) return { allDay: true, day, minutes: 0, zone: null };
  const minutes = Number(m[4]) * 60 + Number(m[5]);
  if (m[7]) {
    const { y, m: mo, d } = parseDayKey(day);
    return { allDay: false, day, minutes, utcMs: Date.UTC(y, mo - 1, d, Number(m[4]), Number(m[5]), Number(m[6] ?? 0)), zone: 'UTC' };
  }
  return { allDay: false, day, minutes, zone: validZone(p.params.TZID) };
}

/** When → UTC ISO in the given zone context. */
function toInstant(w: When, fallbackTz: string): { iso: string; zone: string } {
  if (w.utcMs !== undefined) return { iso: new Date(w.utcMs).toISOString(), zone: fallbackTz };
  const zone = w.zone ?? fallbackTz;
  return { iso: wallToInstant(w.day, w.minutes, zone), zone };
}

function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const min = Number(m[2] ?? 0) * 10080 + Number(m[3] ?? 0) * 1440 + Number(m[4] ?? 0) * 60 + Number(m[5] ?? 0) + Math.round(Number(m[6] ?? 0) / 60);
  return sign * min;
}

function parseRule(value: string, startDay: DayKey, zone: string): { rule: Recurrence | null; approximated: boolean } {
  const kv: Record<string, string> = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) kv[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  const freq = ({ DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' } as Record<string, Recurrence['freq']>)[kv.FREQ];
  if (!freq) return { rule: null, approximated: false };
  let approximated = false;
  const rule: Recurrence = { freq, interval: Math.max(1, Number(kv.INTERVAL) || 1) };
  if (kv.BYDAY) {
    const items = kv.BYDAY.split(',');
    if (freq === 'weekly') {
      rule.byWeekday = items.map((s) => DAY_CODES.indexOf(s.slice(-2))).filter((n) => n >= 0);
    } else if (freq === 'monthly' && items.length === 1 && /^[+-]?\d/.test(items[0])) {
      rule.monthlyMode = 'nthWeekday';
    } else approximated = true;
  }
  if (kv.BYMONTHDAY && kv.BYMONTHDAY !== String(parseDayKey(startDay).d)) approximated = true;
  if (kv.BYSETPOS || kv.BYMONTH || kv.BYWEEKNO || kv.BYYEARDAY) approximated = true;
  if (kv.COUNT) rule.count = Number(kv.COUNT) || null;
  if (kv.UNTIL) {
    const w = parseWhen({ name: 'UNTIL', params: {}, value: kv.UNTIL });
    if (w) rule.until = w.allDay ? w.day : instantToWall(toInstant(w, zone).iso, zone).day;
  }
  return { rule, approximated };
}

/** Short deterministic hash (FNV-1a, 53-bit mix) for stable ids from UIDs. */
function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export const icsEventId = (calendarId: string, uid: string, recurrenceDay?: DayKey) =>
  `ics-${hash(`${calendarId}|${uid}`)}${recurrenceDay ? `-${recurrenceDay}` : ''}`;

function stamp(p: Prop | undefined, fallback: string): string {
  if (!p) return fallback;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(p.value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : fallback;
}

export function parseIcs(text: string, opts: { calendarId: string; defaultTz: string; now?: string }): IcsResult {
  const now = opts.now ?? new Date().toISOString();
  const stats = { events: 0, recurring: 0, overrides: 0, skipped: 0, approximated: 0 };
  const events: CalendarEvent[] = [];
  let calendarName: string | null = null;

  const blocks: { props: Prop[]; alarms: Prop[][] }[] = [];
  let cur: { props: Prop[]; alarms: Prop[][] } | null = null;
  let alarm: Prop[] | null = null;
  for (const line of unfold(text)) {
    if (!line.trim()) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN' && p.value === 'VEVENT') cur = { props: [], alarms: [] };
    else if (p.name === 'END' && p.value === 'VEVENT') {
      if (cur) blocks.push(cur);
      cur = null;
    } else if (p.name === 'BEGIN' && p.value === 'VALARM' && cur) alarm = [];
    else if (p.name === 'END' && p.value === 'VALARM' && cur && alarm) {
      cur.alarms.push(alarm);
      alarm = null;
    } else if (alarm) alarm.push(p);
    else if (cur) cur.props.push(p);
    else if ((p.name === 'X-WR-CALNAME' || p.name === 'NAME') && !calendarName) calendarName = unescapeText(p.value);
  }

  for (const b of blocks) {
    const get = (n: string) => b.props.find((p) => p.name === n);
    const uid = get('UID')?.value.trim();
    const startProp = get('DTSTART');
    const start = startProp ? parseWhen(startProp) : null;
    const title = unescapeText(get('SUMMARY')?.value ?? '').trim() || '(Không tiêu đề)';
    if (!uid || !start || get('STATUS')?.value.trim().toUpperCase() === 'CANCELLED') {
      stats.skipped++;
      continue;
    }
    const endProp = get('DTEND');
    const endW = endProp ? parseWhen(endProp) : null;
    const durProp = get('DURATION');
    const dur = durProp ? parseDuration(durProp.value) : null;
    const recId = get('RECURRENCE-ID');
    const recWhen = recId ? parseWhen(recId) : null;
    const recDay: DayKey | null = recWhen
      ? recWhen.allDay
        ? recWhen.day
        : instantToWall(toInstant(recWhen, opts.defaultTz).iso, start.zone && start.zone !== 'UTC' ? start.zone : opts.defaultTz).day
      : null;

    const updatedAt = stamp(get('LAST-MODIFIED') ?? get('DTSTAMP'), now);
    const reminders = b.alarms
      .map((a) => a.find((p) => p.name === 'TRIGGER'))
      .filter((p): p is Prop => !!p && !p.params.RELATED?.toUpperCase().includes('END'))
      .map((p) => parseDuration(p.value))
      .filter((n): n is number => n !== null && n <= 0)
      .map((n) => -n);

    const base = {
      id: icsEventId(opts.calendarId, uid, recDay ?? undefined),
      calendarId: opts.calendarId,
      title,
      description: unescapeText(get('DESCRIPTION')?.value ?? '').slice(0, 10_000),
      location: unescapeText(get('LOCATION')?.value ?? '').slice(0, 300),
      color: null,
      reminders: [...new Set(reminders)].slice(0, 5),
      createdAt: stamp(get('CREATED'), updatedAt),
      updatedAt,
      deletedAt: null,
    };

    let ev: CalendarEvent;
    let zone = opts.defaultTz;
    if (start.allDay) {
      let end = endW?.allDay ? endW.day : addDays(start.day, dur && dur >= 1440 ? Math.round(dur / 1440) : 1);
      if (end <= start.day) end = addDays(start.day, 1);
      ev = { ...base, allDay: true, start: start.day, end, timeZone: null };
    } else {
      const s = toInstant(start, opts.defaultTz);
      zone = s.zone;
      let endIso: string;
      if (endW && !endW.allDay) endIso = toInstant(endW, zone).iso;
      else if (dur !== null && dur > 0) endIso = new Date(Date.parse(s.iso) + dur * 60000).toISOString();
      else endIso = new Date(Date.parse(s.iso) + 60 * 60000).toISOString();
      if (Date.parse(endIso) <= Date.parse(s.iso)) endIso = new Date(Date.parse(s.iso) + 60 * 60000).toISOString();
      ev = { ...base, allDay: false, start: s.iso, end: endIso, timeZone: zone };
    }

    if (recDay) {
      ev.recurrenceMasterId = icsEventId(opts.calendarId, uid);
      ev.recurrenceDay = recDay;
      stats.overrides++;
    } else {
      const rr = get('RRULE');
      if (rr) {
        const startDay = start.allDay ? start.day : instantToWall(toInstant(start, opts.defaultTz).iso, zone).day;
        const { rule, approximated } = parseRule(rr.value, startDay, zone);
        if (rule) {
          ev.recurrence = rule;
          stats.recurring++;
          if (approximated) stats.approximated++;
        } else stats.approximated++;
      }
      const ex: DayKey[] = [];
      for (const p of b.props.filter((x) => x.name === 'EXDATE')) {
        for (const v of p.value.split(',')) {
          const w = parseWhen({ ...p, value: v });
          if (!w) continue;
          ex.push(w.allDay ? w.day : instantToWall(toInstant(w, opts.defaultTz).iso, zone).day);
        }
      }
      if (ex.length) ev.exdates = ex;
    }
    // weekly rule without BYDAY repeats on the start weekday; keep explicit for clarity
    if (ev.recurrence?.freq === 'weekly' && !ev.recurrence.byWeekday?.length) {
      const d = start.allDay ? start.day : instantToWall(ev.start, zone).day;
      ev.recurrence.byWeekday = [weekday(d)];
    }
    events.push(ev);
    stats.events++;
  }
  return { events, calendarName, stats };
}
