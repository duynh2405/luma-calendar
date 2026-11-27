/**
 * Editing and deleting occurrences of a recurring series, Google-Calendar style:
 *  - 'this'      → an override record (edit) or an exdate (delete)
 *  - 'following' → the series is split at the occurrence
 *  - 'all'       → the master changes; the edit is applied relative to the occurrence
 *
 * Pure functions: they return the records to upsert; the store persists them.
 */
import type { CalendarEvent, ID } from '../model/types';
import { addDays, type DayKey, diffDays } from '../time/days';
import { instantToWall, wallToInstant } from '../time/zone';
import { seriesStartDay } from './expand';
import { occurrenceDays, type Recurrence } from './recurrence';

export type EditScope = 'this' | 'following' | 'all';

/** Fields that describe an event's content and time (no identity / bookkeeping). */
export type EventContent = Omit<
  CalendarEvent,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'recurrence' | 'exdates' | 'recurrenceMasterId' | 'recurrenceDay'
>;

export interface SeriesChange {
  upsert: CalendarEvent[];
}

interface Ctx {
  now: string;
  newId: () => ID;
  /** All events (to find the series' overrides). */
  events: CalendarEvent[];
}

/** Shift an event's start/end by whole days, keeping wall-clock times in its own zone. */
export function shiftDays<T extends EventContent>(e: T, days: number): T {
  if (days === 0) return e;
  if (e.allDay) return { ...e, start: addDays(e.start, days), end: addDays(e.end, days) };
  const s = instantToWall(e.start, (e.timeZone as string));
  const start = wallToInstant(addDays(s.day, days), s.minutes, (e.timeZone as string));
  const end = new Date(Date.parse(start) + (Date.parse(e.end) - Date.parse(e.start))).toISOString();
  return { ...e, start, end };
}

function contentDay(e: EventContent): DayKey {
  return e.allDay ? e.start : instantToWall(e.start, (e.timeZone as string)).day;
}

/** Move weekly weekdays along with a day shift. */
function shiftRule(rule: Recurrence, days: number): Recurrence {
  if (rule.freq !== 'weekly' || !rule.byWeekday?.length || days % 7 === 0) return rule;
  return { ...rule, byWeekday: rule.byWeekday.map((w) => (((w + days) % 7) + 7) % 7) };
}

function overridesOf(masterId: ID, events: CalendarEvent[]) {
  return events.filter((e) => e.recurrenceMasterId === masterId && !e.deletedAt);
}

/** Number of occurrences strictly before `day` (for COUNT-limited series). */
function countBefore(master: CalendarEvent, day: DayKey): number {
  if (!master.recurrence) return 0;
  return occurrenceDays(seriesStartDay(master), { ...master.recurrence, count: null }, seriesStartDay(master), addDays(day, -1)).length;
}

export function editOccurrence(
  scope: EditScope,
  master: CalendarEvent,
  occurrenceDay: DayKey,
  edited: EventContent,
  ctx: Ctx,
): SeriesChange {
  const rule = master.recurrence;
  if (!rule) throw new Error('not-recurring');
  const start = seriesStartDay(master);

  if (scope === 'this') {
    const override: CalendarEvent = {
      ...(edited as CalendarEvent),
      id: ctx.newId(),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      deletedAt: null,
      recurrence: null,
      exdates: [],
      recurrenceMasterId: master.id,
      recurrenceDay: occurrenceDay,
    };
    return { upsert: [override] };
  }

  // Day shift the edit applies to the series (e.g. moved Monday → Tuesday = +1).
  const k = diffDays(contentDay(edited), occurrenceDay);

  if (scope === 'all' || occurrenceDay <= start) {
    const next: CalendarEvent = {
      ...(shiftDays(edited, -diffDays(occurrenceDay, start)) as CalendarEvent),
      id: master.id,
      createdAt: master.createdAt,
      updatedAt: ctx.now,
      deletedAt: null,
      recurrence: shiftRule(rule, k),
      exdates: (master.exdates ?? []).map((d) => addDays(d, k)),
      recurrenceMasterId: null,
      recurrenceDay: null,
    };
    if (next.recurrence?.until) next.recurrence = { ...next.recurrence, until: addDays(next.recurrence.until, k) };
    const ovs = k === 0 ? [] : overridesOf(master.id, ctx.events).map((o) => ({ ...o, recurrenceDay: addDays(o.recurrenceDay!, k), updatedAt: ctx.now }));
    return { upsert: [next, ...ovs] };
  }

  // 'following': end the old series the day before, start a new one at the edited occurrence.
  const before = countBefore(master, occurrenceDay);
  const oldRule: Recurrence = rule.count ? { ...rule, count: before, until: null } : { ...rule, until: addDays(occurrenceDay, -1) };
  const newId = ctx.newId();
  const newRule: Recurrence = shiftRule(rule.count ? { ...rule, count: Math.max(1, rule.count - before) } : rule, k);
  if (newRule.until) newRule.until = addDays(newRule.until, k);
  const oldMaster: CalendarEvent = {
    ...master,
    recurrence: oldRule,
    exdates: (master.exdates ?? []).filter((d) => d < occurrenceDay),
    updatedAt: ctx.now,
  };
  const newMaster: CalendarEvent = {
    ...(edited as CalendarEvent),
    id: newId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    deletedAt: null,
    recurrence: newRule,
    exdates: (master.exdates ?? []).filter((d) => d >= occurrenceDay).map((d) => addDays(d, k)),
    recurrenceMasterId: null,
    recurrenceDay: null,
  };
  const moved = overridesOf(master.id, ctx.events)
    .filter((o) => o.recurrenceDay! >= occurrenceDay)
    .map((o) => ({ ...o, recurrenceMasterId: newId, recurrenceDay: addDays(o.recurrenceDay!, k), updatedAt: ctx.now }));
  return { upsert: [oldMaster, newMaster, ...moved] };
}

export function deleteOccurrence(
  scope: EditScope,
  master: CalendarEvent,
  occurrenceDay: DayKey,
  ctx: Ctx,
): SeriesChange {
  const rule = master.recurrence;
  if (!rule) throw new Error('not-recurring');
  const start = seriesStartDay(master);
  if (scope === 'this') {
    const exdates = Array.from(new Set([...(master.exdates ?? []), occurrenceDay])).sort();
    const ovs = overridesOf(master.id, ctx.events)
      .filter((o) => o.recurrenceDay === occurrenceDay)
      .map((o) => ({ ...o, deletedAt: ctx.now, updatedAt: ctx.now }));
    return { upsert: [{ ...master, exdates, updatedAt: ctx.now }, ...ovs] };
  }
  if (scope === 'all' || occurrenceDay <= start) {
    const ovs = overridesOf(master.id, ctx.events).map((o) => ({ ...o, deletedAt: ctx.now, updatedAt: ctx.now }));
    return { upsert: [{ ...master, deletedAt: ctx.now, updatedAt: ctx.now }, ...ovs] };
  }
  const before = countBefore(master, occurrenceDay);
  const nextRule: Recurrence = rule.count ? { ...rule, count: before, until: null } : { ...rule, until: addDays(occurrenceDay, -1) };
  const ovs = overridesOf(master.id, ctx.events)
    .filter((o) => o.recurrenceDay! >= occurrenceDay)
    .map((o) => ({ ...o, deletedAt: ctx.now, updatedAt: ctx.now }));
  return { upsert: [{ ...master, recurrence: nextRule, updatedAt: ctx.now }, ...ovs] };
}

