import { describe, expect, it } from 'vitest';

import type { CalendarEvent, TimedEvent } from '../model/types';
import { wallToInstant } from '../time/zone';
import { deleteOccurrence, editOccurrence, type EventContent } from './edit';
import { expandEvents } from './expand';

const TZ = 'Asia/Ho_Chi_Minh';
const at = (day: string, h: number) => wallToInstant(day, h * 60, TZ);
const master: TimedEvent = {
  id: 'm',
  calendarId: 'c',
  title: 'Họp tuần',
  description: '',
  location: '',
  color: null,
  createdAt: 't0',
  updatedAt: 't0',
  deletedAt: null,
  allDay: false,
  start: at('2026-11-02', 9),
  end: at('2026-11-02', 10),
  timeZone: TZ,
  recurrence: { freq: 'weekly', interval: 1 },
  exdates: [],
};
let seq = 0;
const ctx = (events: CalendarEvent[] = [master]) => ({ now: 't1', newId: () => `n${++seq}`, events });
const content = (e: CalendarEvent, patch: Partial<EventContent>): EventContent => {
  const { id: _i, createdAt: _c, updatedAt: _u, deletedAt: _d, recurrence: _r, exdates: _x, recurrenceMasterId: _m, recurrenceDay: _y, ...rest } = e;
  return { ...rest, ...patch } as EventContent;
};
const keysIn = (events: CalendarEvent[], from: string, to: string) =>
  expandEvents(events.filter((e) => !e.deletedAt), from, to, TZ)
    .map((i) => `${i.instanceKey}:${i.title}:${new Date(i.start).toISOString().slice(0, 13)}`)
    .sort();

describe('edit occurrences', () => {
  it("'this' creates an override that replaces one occurrence", () => {
    const edited = content(master, { title: 'Họp dời', start: at('2026-11-17', 14), end: at('2026-11-17', 15) });
    const { upsert } = editOccurrence('this', master, '2026-11-16', edited, ctx());
    const all = [master, ...upsert];
    expect(keysIn(all, '2026-11-15', '2026-11-22')).toEqual([`${upsert[0].id}:Họp dời:2026-11-17T07`]);
  });

  it("'all' moves the whole series by the same days and time", () => {
    // Drag the 16/11 (Mon) occurrence to Tue 17/11 at 14:00
    const edited = content(master, { start: at('2026-11-17', 14), end: at('2026-11-17', 15) });
    const { upsert } = editOccurrence('all', master, '2026-11-16', edited, ctx());
    const next = upsert[0];
    expect(next.id).toBe('m');
    expect(next.start).toBe(at('2026-11-03', 14));
    expect(keysIn([next], '2026-11-23', '2026-11-29')).toEqual(['m@2026-11-24:Họp tuần:2026-11-24T07']);
  });

  it("'all' shifts exdates and overrides with the series", () => {
    const ov: CalendarEvent = { ...master, id: 'o', recurrence: null, recurrenceMasterId: 'm', recurrenceDay: '2026-11-23' };
    const m2 = { ...master, exdates: ['2026-11-09'] };
    const edited = content(m2, { start: at('2026-11-17', 9), end: at('2026-11-17', 10) });
    const { upsert } = editOccurrence('all', m2, '2026-11-16', edited, ctx([m2, ov]));
    expect(upsert[0].exdates).toEqual(['2026-11-10']);
    expect(upsert.find((e) => e.id === 'o')!.recurrenceDay).toBe('2026-11-24');
  });

  it("'following' splits the series", () => {
    const edited = content(master, { title: 'Họp mới', start: at('2026-11-16', 10), end: at('2026-11-16', 11) });
    const { upsert } = editOccurrence('following', master, '2026-11-16', edited, ctx());
    const [oldM, newM] = upsert;
    expect(oldM.recurrence!.until).toBe('2026-11-15');
    expect(newM.recurrence).toMatchObject({ freq: 'weekly' });
    expect(keysIn(upsert, '2026-11-02', '2026-11-23')).toEqual([
      'm@2026-11-02:Họp tuần:2026-11-02T02',
      'm@2026-11-09:Họp tuần:2026-11-09T02',
      `${newM.id}@2026-11-16:Họp mới:2026-11-16T03`,
      `${newM.id}@2026-11-23:Họp mới:2026-11-23T03`,
    ]);
  });

  it("'following' with COUNT keeps the total number of occurrences", () => {
    const m = { ...master, recurrence: { freq: 'weekly' as const, interval: 1, count: 4 } };
    const edited = content(m, { start: at('2026-11-16', 10), end: at('2026-11-16', 11) });
    const { upsert } = editOccurrence('following', m, '2026-11-16', edited, ctx([m]));
    expect(upsert[0].recurrence!.count).toBe(2);
    expect(upsert[1].recurrence!.count).toBe(2);
    expect(keysIn(upsert, '2026-11-01', '2027-01-31')).toHaveLength(4);
  });

  it("'following' on the first occurrence behaves like 'all'", () => {
    const edited = content(master, { title: 'Đổi tên' });
    const { upsert } = editOccurrence('following', master, '2026-11-02', edited, ctx());
    expect(upsert).toHaveLength(1);
    expect(upsert[0]).toMatchObject({ id: 'm', title: 'Đổi tên' });
  });
});

describe('delete occurrences', () => {
  it("'this' adds an exdate", () => {
    const { upsert } = deleteOccurrence('this', master, '2026-11-09', ctx());
    expect(upsert[0].exdates).toEqual(['2026-11-09']);
    expect(keysIn(upsert, '2026-11-09', '2026-11-09')).toEqual([]);
  });
  it("'following' ends the series", () => {
    const { upsert } = deleteOccurrence('following', master, '2026-11-16', ctx());
    expect(upsert[0].recurrence!.until).toBe('2026-11-15');
    expect(keysIn(upsert, '2026-11-01', '2026-12-31')).toHaveLength(2);
  });
  it("'all' soft-deletes the master and its overrides", () => {
    const ov: CalendarEvent = { ...master, id: 'o', recurrence: null, recurrenceMasterId: 'm', recurrenceDay: '2026-11-23' };
    const { upsert } = deleteOccurrence('all', master, '2026-11-16', ctx([master, ov]));
    expect(upsert.every((e) => e.deletedAt === 't1')).toBe(true);
    expect(upsert).toHaveLength(2);
  });
});
