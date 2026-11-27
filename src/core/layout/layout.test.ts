import { describe, expect, it } from 'vitest';

import type { AllDayEvent, CalendarEvent, TimedEvent } from '../model/types';
import { wallToInstant } from '../time/zone';
import {
  eventDayRange,
  findConflicts,
  isSpanning,
  layoutDay,
  layoutSpanRow,
  layoutSpanRowVisible,
  timedSegments,
} from './layout';

const TZ = 'Asia/Ho_Chi_Minh';
const base = { calendarId: 'c', description: '', location: '', color: null, createdAt: '', updatedAt: '', deletedAt: null };

function timed(id: string, day: string, sh: number, eh: number, endDay = day): TimedEvent {
  return {
    ...base,
    id,
    title: id,
    allDay: false,
    start: wallToInstant(day, sh * 60, TZ),
    end: wallToInstant(endDay, eh * 60, TZ),
    timeZone: TZ,
  };
}
function allDay(id: string, start: string, endExclusive: string): AllDayEvent {
  return { ...base, id, title: id, allDay: true, start, end: endExclusive, timeZone: null };
}

describe('classification', () => {
  it('all-day and ≥24h events span', () => {
    expect(isSpanning(allDay('a', '2026-11-27', '2026-11-28'))).toBe(true);
    expect(isSpanning(timed('b', '2026-11-27', 8, 8, '2026-11-28'))).toBe(true);
    expect(isSpanning(timed('c', '2026-11-27', 8, 12))).toBe(false);
  });
  it('event ending at midnight does not touch the next day', () => {
    expect(eventDayRange(timed('a', '2026-11-27', 20, 0, '2026-11-28'), TZ)).toEqual({
      first: '2026-11-27',
      last: '2026-11-27',
    });
  });
  it('all-day range uses exclusive end', () => {
    expect(eventDayRange(allDay('a', '2026-11-27', '2026-11-30'), TZ)).toEqual({
      first: '2026-11-27',
      last: '2026-11-29',
    });
  });
});

describe('timed segments', () => {
  it('splits an overnight event across two days', () => {
    const e = timed('n', '2026-11-27', 22, 2, '2026-11-28');
    const segs = timedSegments([e], ['2026-11-27', '2026-11-28'], TZ);
    expect(segs.get('2026-11-27')![0]).toMatchObject({ startMin: 1320, endMin: 1440, continuesAfter: true });
    expect(segs.get('2026-11-28')![0]).toMatchObject({ startMin: 0, endMin: 120, continuesBefore: true });
  });
});

describe('layoutDay', () => {
  const seg = (e: CalendarEvent) => timedSegments([e], ['2026-11-27'], TZ).get('2026-11-27')![0];
  it('non-overlapping events use full width', () => {
    const r = layoutDay([seg(timed('a', '2026-11-27', 8, 9)), seg(timed('b', '2026-11-27', 9, 10))]);
    expect(r.map((p) => [p.event.id, p.column, p.columns])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
  });
  it('overlapping events share columns within a cluster', () => {
    const r = layoutDay([
      seg(timed('a', '2026-11-27', 8, 11)),
      seg(timed('b', '2026-11-27', 9, 10)),
      seg(timed('c', '2026-11-27', 10, 12)),
      seg(timed('d', '2026-11-27', 13, 14)),
    ]);
    const m = Object.fromEntries(r.map((p) => [p.event.id, [p.column, p.columns]]));
    expect(m.a).toEqual([0, 2]);
    expect(m.b).toEqual([1, 2]);
    expect(m.c).toEqual([1, 2]); // reuses column 1 after b ends
    expect(m.d).toEqual([0, 1]);
  });
});

describe('layoutSpanRow', () => {
  const week = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];
  it('stacks overlapping bars into lanes and clips to the row', () => {
    const bars = layoutSpanRow(
      [
        allDay('long', '2026-11-20', '2026-11-26'), // continues from previous week
        allDay('mid', '2026-11-24', '2026-11-27'),
        allDay('late', '2026-11-27', '2026-12-02'), // continues into next week
      ],
      week,
      TZ,
      false,
    );
    const m = Object.fromEntries(bars.map((b) => [b.event.id, b]));
    expect(m.long).toMatchObject({ startCol: 0, span: 3, lane: 0, continuesBefore: true });
    expect(m.mid).toMatchObject({ startCol: 1, span: 3, lane: 1 });
    expect(m.late).toMatchObject({ startCol: 4, span: 3, lane: 0, continuesAfter: true });
  });
  it('month rows include timed events when asked', () => {
    const bars = layoutSpanRow([timed('t', '2026-11-25', 8, 9)], week, TZ, true);
    expect(bars[0]).toMatchObject({ startCol: 2, span: 1 });
  });
});

describe('layoutSpanRowVisible (hidden weekends)', () => {
  it('maps bars onto visible columns and drops weekend-only events', () => {
    const weekdays = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']; // Mon–Fri
    const bars = layoutSpanRowVisible(
      [allDay('fri-sun', '2026-11-27', '2026-11-30'), allDay('sat', '2026-11-28', '2026-11-29'), allDay('wed', '2026-11-25', '2026-11-26')],
      weekdays,
      TZ,
      false,
    );
    const m = Object.fromEntries(bars.map((b) => [b.event.id, b]));
    expect(m.sat).toBeUndefined();
    expect(m['fri-sun']).toMatchObject({ startCol: 4, span: 1, continuesAfter: true });
    expect(m.wed).toMatchObject({ startCol: 2, span: 1 });
  });
});

describe('conflicts', () => {
  it('finds overlapping timed events only', () => {
    const events = [timed('a', '2026-11-27', 8, 10), timed('b', '2026-11-27', 10, 11), allDay('c', '2026-11-27', '2026-11-28')];
    const r = findConflicts(events, wallToInstant('2026-11-27', 9 * 60, TZ), wallToInstant('2026-11-27', 10 * 60, TZ));
    expect(r.map((e) => e.id)).toEqual(['a']);
  });
});
