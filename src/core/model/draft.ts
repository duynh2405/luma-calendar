/**
 * Editor draft ↔ event conversion. The form works in wall-clock time of the
 * display time zone; all-day end dates are inclusive in the form and exclusive in storage.
 */
import { addDays, type DayKey } from '../time/days';
import { instantToWall, wallToInstant } from '../time/zone';
import type { Recurrence } from '../recurrence/recurrence';
import type { CalendarEvent, ID } from './types';

export interface EventDraft {
  title: string;
  calendarId: ID;
  allDay: boolean;
  startDay: DayKey;
  startMin: number;
  /** inclusive for all-day */
  endDay: DayKey;
  endMin: number;
  location: string;
  description: string;
  color: string | null;
  /** Repeat rule (series only). */
  recurrence?: Recurrence | null;
}

export function draftFromEvent(e: CalendarEvent, tz: string): EventDraft {
  const common = {
    title: e.title,
    calendarId: e.calendarId,
    location: e.location,
    description: e.description,
    color: e.color,
    recurrence: e.recurrence ?? null,
  };
  if (e.allDay) {
    return { ...common, allDay: true, startDay: e.start, startMin: 9 * 60, endDay: addDays(e.end, -1), endMin: 10 * 60 };
  }
  const s = instantToWall(e.start, tz);
  const en = instantToWall(e.end, tz);
  return { ...common, allDay: false, startDay: s.day, startMin: s.minutes, endDay: en.day, endMin: en.minutes };
}

/** Fields of an event derived from a draft (everything except BaseRecord fields). */
export function eventFieldsFromDraft(d: EventDraft, tz: string) {
  const common = {
    title: d.title.trim(),
    calendarId: d.calendarId,
    location: d.location.trim(),
    description: d.description,
    color: d.color,
    recurrence: d.recurrence ?? null,
  };
  if (d.allDay) {
    const endDay = d.endDay < d.startDay ? d.startDay : d.endDay;
    return { ...common, allDay: true as const, start: d.startDay, end: addDays(endDay, 1), timeZone: null };
  }
  return {
    ...common,
    allDay: false as const,
    start: wallToInstant(d.startDay, d.startMin, tz),
    end: wallToInstant(d.endDay, d.endMin, tz),
    timeZone: tz,
  };
}

/** Add wall-clock minutes to a (day, minutes) pair; minutes may overflow days. */
export function addWallMinutes(day: DayKey, minutes: number, delta: number): { day: DayKey; minutes: number } {
  const total = minutes + delta;
  const dayShift = Math.floor(total / 1440);
  return { day: addDays(day, dayShift), minutes: total - dayShift * 1440 };
}

/** Shift an event by `deltaMin` wall-clock minutes (timed) or whole days (all-day), keeping its duration. */
export function shiftEvent(
  e: CalendarEvent,
  tz: string,
  deltaMin: number,
): Pick<CalendarEvent, 'start' | 'end'> {
  if (e.allDay) {
    const days = Math.round(deltaMin / 1440);
    return { start: addDays(e.start, days), end: addDays(e.end, days) };
  }
  const s = instantToWall(e.start, tz);
  const ns = addWallMinutes(s.day, s.minutes, deltaMin);
  const start = wallToInstant(ns.day, ns.minutes, tz);
  const duration = Date.parse(e.end) - Date.parse(e.start);
  return { start, end: new Date(Date.parse(start) + duration).toISOString() };
}
