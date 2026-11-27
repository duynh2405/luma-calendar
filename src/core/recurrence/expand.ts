/**
 * Turn stored events into displayable instances for a date range:
 * non-recurring events, overrides, and generated occurrences of series.
 */
import { eventDayRange } from '../layout/layout';
import type { AllDayEvent, CalendarEvent, ID, TimedEvent } from '../model/types';
import { addDays, type DayKey, diffDays } from '../time/days';
import { instantToWall, wallToInstant } from '../time/zone';
import { occurrenceDays } from './recurrence';

export type EventInstance = CalendarEvent & {
  /** Unique key of this instance (masterId@day for generated occurrences). */
  instanceKey: string;
  /** Record to edit for "all occurrences" (the series master), or the event itself. */
  masterId: ID;
  /** Original occurrence day for generated occurrences, else null. */
  occurrenceDay: DayKey | null;
};

export function asInstance(e: CalendarEvent): EventInstance {
  return { ...e, instanceKey: e.id, masterId: e.recurrenceMasterId ?? e.id, occurrenceDay: e.recurrenceDay ?? null };
}

/** Day key of an event's start in its own zone (the unit recurrence works in). */
export function seriesStartDay(e: CalendarEvent): DayKey {
  return e.allDay ? e.start : instantToWall(e.start, e.timeZone).day;
}

/** Build the occurrence of `master` on `day` (same wall time and duration). */
export function occurrenceOn(master: CalendarEvent, day: DayKey): CalendarEvent {
  if (master.allDay) {
    const span = diffDays(master.end, master.start);
    return { ...master, start: day, end: addDays(day, span) } as AllDayEvent;
  }
  const s = instantToWall(master.start, master.timeZone);
  const start = wallToInstant(day, s.minutes, master.timeZone);
  const end = new Date(Date.parse(start) + (Date.parse(master.end) - Date.parse(master.start))).toISOString();
  return { ...master, start, end } as TimedEvent;
}

/**
 * Expand events into instances touching [from, to] (display days in `tz`).
 * Deleted events are expected to be filtered out by the caller.
 */
export function expandEvents(events: CalendarEvent[], from: DayKey, to: DayKey, tz: string): EventInstance[] {
  const out: EventInstance[] = [];
  // Live overrides per master: their days replace generated occurrences.
  const overridden = new Map<ID, Set<DayKey>>();
  for (const e of events) {
    if (e.recurrenceMasterId && e.recurrenceDay) {
      let set = overridden.get(e.recurrenceMasterId);
      if (!set) overridden.set(e.recurrenceMasterId, (set = new Set()));
      set.add(e.recurrenceDay);
    }
  }
  for (const e of events) {
    if (!e.recurrence) {
      const r = eventDayRange(e, tz);
      if (r.last >= from && r.first <= to) out.push(asInstance(e));
      continue;
    }
    // Margin: an occurrence that starts before `from` can still overlap it (multi-day / time zone).
    const span = Math.max(0, diffDays(eventDayRange(e, e.timeZone ?? tz).last, eventDayRange(e, e.timeZone ?? tz).first));
    const days = occurrenceDays(seriesStartDay(e), e.recurrence, addDays(from, -span - 1), addDays(to, 1));
    const skip = new Set([...(e.exdates ?? []), ...(overridden.get(e.id) ?? [])]);
    for (const day of days) {
      if (skip.has(day)) continue;
      const occ = occurrenceOn(e, day);
      const r = eventDayRange(occ, tz);
      if (r.last < from || r.first > to) continue;
      out.push({ ...occ, instanceKey: `${e.id}@${day}`, masterId: e.id, occurrenceDay: day });
    }
  }
  return out;
}
