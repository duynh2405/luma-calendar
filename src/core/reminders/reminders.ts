/**
 * Reminder planning (pure). Turns events/tasks into the list of notifications that should be
 * scheduled with the OS: stable ids, fire times in the future, soonest first, capped (iOS keeps 64).
 *
 *  - Timed event: fires `offset` minutes before its start.
 *  - All-day event / task without a time: counts as 09:00 that day (display zone).
 *  - Done, cancelled, deleted items never fire; recurring events are expanded over the horizon.
 */
import type { CalendarEvent, ID, Task } from '../model/types';
import { expandEvents } from '../recurrence/expand';
import { addDays, type DayKey } from '../time/days';
import { instantToWall, wallToInstant } from '../time/zone';

export const DEFAULT_ALL_DAY_MIN = 9 * 60;
export const MAX_SCHEDULED = 60;

export interface PlannedReminder {
  /** Stable: same item + occurrence + offset → same id, so rescheduling never duplicates. */
  id: string;
  fireAt: string;
  title: string;
  /** Start of the thing being reminded about (ISO). */
  startsAt: string;
  allDay: boolean;
  offsetMin: number;
  kind: 'event' | 'task';
  refId: ID;
  day: DayKey;
}

export function planReminders(input: {
  events: CalendarEvent[];
  tasks: Task[];
  tz: string;
  nowMs: number;
  horizonDays?: number;
  limit?: number;
}): PlannedReminder[] {
  const { events, tasks, tz, nowMs } = input;
  const today = instantToWall(nowMs, tz).day;
  const to = addDays(today, input.horizonDays ?? 30);
  const out: PlannedReminder[] = [];

  const push = (p: Omit<PlannedReminder, 'fireAt' | 'id'> & { baseMs: number; key: string }) => {
    const fireMs = p.baseMs - p.offsetMin * 60_000;
    if (fireMs <= nowMs) return;
    const { baseMs: _b, key, ...rest } = p;
    out.push({ ...rest, id: `${key}|${p.offsetMin}`, fireAt: new Date(fireMs).toISOString() });
  };

  for (const e of expandEvents(events.filter((x) => !x.deletedAt), addDays(today, -1), to, tz)) {
    if (e.doneAt || !e.reminders?.length) continue;
    const startMs = e.allDay ? Date.parse(wallToInstant(e.start, DEFAULT_ALL_DAY_MIN, tz)) : Date.parse(e.start);
    const day = e.allDay ? e.start : instantToWall(e.start, tz).day;
    for (const offsetMin of new Set(e.reminders)) {
      push({
        baseMs: startMs,
        key: `e:${e.masterId ?? e.id}:${e.occurrenceDay ?? day}`,
        title: e.title,
        startsAt: new Date(startMs).toISOString(),
        allDay: e.allDay,
        offsetMin,
        kind: 'event',
        refId: e.masterId ?? e.id,
        day,
      });
    }
  }

  for (const t of tasks) {
    if (t.deletedAt || !t.dueDay || !t.reminders?.length || t.status === 'done' || t.status === 'cancelled') continue;
    if (t.dueDay > to) continue;
    const startMs = Date.parse(wallToInstant(t.dueDay, t.dueMin ?? DEFAULT_ALL_DAY_MIN, tz));
    for (const offsetMin of new Set(t.reminders)) {
      push({
        baseMs: startMs,
        key: `t:${t.id}:${t.dueDay}`,
        title: t.title,
        startsAt: new Date(startMs).toISOString(),
        allDay: t.dueMin === null,
        offsetMin,
        kind: 'task',
        refId: t.id,
        day: t.dueDay,
      });
    }
  }

  return out.sort((a, b) => (a.fireAt < b.fireAt ? -1 : a.fireAt > b.fireAt ? 1 : a.id < b.id ? -1 : 1)).slice(0, input.limit ?? MAX_SCHEDULED);
}

/** Vietnamese/English body text: "Bắt đầu lúc 14:00 (còn 30 phút)". */
export function reminderBody(p: PlannedReminder, locale: 'vi' | 'en', tz: string): string {
  const w = instantToWall(p.startsAt, tz);
  const hh = `${String(Math.floor(w.minutes / 60)).padStart(2, '0')}:${String(w.minutes % 60).padStart(2, '0')}`;
  const left =
    p.offsetMin === 0
      ? locale === 'vi' ? 'đến giờ' : 'now'
      : p.offsetMin % 1440 === 0
        ? locale === 'vi' ? `còn ${p.offsetMin / 1440} ngày` : `in ${p.offsetMin / 1440} d`
        : p.offsetMin % 60 === 0
          ? locale === 'vi' ? `còn ${p.offsetMin / 60} giờ` : `in ${p.offsetMin / 60} h`
          : locale === 'vi' ? `còn ${p.offsetMin} phút` : `in ${p.offsetMin} min`;
  const kind = p.kind === 'task' ? (locale === 'vi' ? 'Hạn' : 'Due') : locale === 'vi' ? 'Bắt đầu' : 'Starts';
  return p.allDay ? `${kind} ${w.day.slice(8)}/${w.day.slice(5, 7)} (${left})` : `${kind} ${hh} (${left})`;
}
