import { describe, expect, it } from 'vitest';

import type { CalendarEvent, TimedEvent } from '../model/types';
import { wallToInstant } from '../time/zone';
import { expandEvents } from './expand';

const TZ = 'Asia/Ho_Chi_Minh';
const base = { calendarId: 'c', description: '', location: '', color: null, createdAt: '', updatedAt: '', deletedAt: null };

const weekly: TimedEvent = {
  ...base,
  id: 'm',
  title: 'Họp tuần',
  allDay: false,
  start: wallToInstant('2026-11-02', 9 * 60, TZ),
  end: wallToInstant('2026-11-02', 10 * 60, TZ),
  timeZone: TZ,
  recurrence: { freq: 'weekly', interval: 1 },
};

describe('expandEvents', () => {
  it('generates occurrences with the same wall time', () => {
    const r = expandEvents([weekly], '2026-11-23', '2026-11-29', TZ);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ instanceKey: 'm@2026-11-23', masterId: 'm', occurrenceDay: '2026-11-23' });
    expect(r[0].start).toBe(wallToInstant('2026-11-23', 9 * 60, TZ));
  });
  it('applies exdates and overrides', () => {
    const master = { ...weekly, exdates: ['2026-11-09'] };
    const override: CalendarEvent = {
      ...weekly,
      id: 'o',
      recurrence: null,
      recurrenceMasterId: 'm',
      recurrenceDay: '2026-11-16',
      start: wallToInstant('2026-11-17', 14 * 60, TZ),
      end: wallToInstant('2026-11-17', 15 * 60, TZ),
    };
    const r = expandEvents([master, override], '2026-11-01', '2026-11-30', TZ);
    expect(r.map((i) => i.instanceKey).sort()).toEqual(['m@2026-11-02', 'm@2026-11-23', 'm@2026-11-30', 'o']);
    const o = r.find((i) => i.instanceKey === 'o')!;
    expect(o.masterId).toBe('m');
    expect(o.occurrenceDay).toBe('2026-11-16');
  });
  it('includes multi-day occurrences that start before the window', () => {
    const allDay: CalendarEvent = {
      ...base,
      id: 'a',
      title: 'Hội chợ',
      allDay: true,
      start: '2026-01-30',
      end: '2026-02-02',
      timeZone: null,
      recurrence: { freq: 'monthly', interval: 1 },
    };
    const r = expandEvents([allDay], '2026-12-01', '2026-12-01', TZ);
    expect(r.map((i) => i.occurrenceDay)).toEqual(['2026-11-30']);
  });
  it('passes non-recurring events through by range', () => {
    const one = { ...weekly, id: 'x', recurrence: null };
    expect(expandEvents([one], '2026-11-02', '2026-11-02', TZ)).toHaveLength(1);
    expect(expandEvents([one], '2026-11-03', '2026-11-05', TZ)).toHaveLength(0);
  });
});
