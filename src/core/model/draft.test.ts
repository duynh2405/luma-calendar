import { describe, expect, it } from 'vitest';

import { addWallMinutes, draftFromEvent, eventFieldsFromDraft, shiftEvent, type EventDraft } from './draft';
import type { CalendarEvent } from './types';

const TZ = 'Asia/Ho_Chi_Minh';
const d: EventDraft = {
  title: '  Setup loa  ',
  calendarId: 'c',
  allDay: false,
  startDay: '2026-11-28',
  startMin: 7 * 60,
  endDay: '2026-11-28',
  endMin: 9 * 60,
  location: '',
  description: '',
  color: null,
};

describe('draft conversion', () => {
  it('timed draft → UTC instants and back', () => {
    const f = eventFieldsFromDraft(d, TZ);
    expect(f).toMatchObject({ title: 'Setup loa', start: '2026-11-28T00:00:00.000Z', end: '2026-11-28T02:00:00.000Z' });
    const e = { ...f, id: 'x', createdAt: '', updatedAt: '', deletedAt: null } as CalendarEvent;
    expect(draftFromEvent(e, TZ)).toMatchObject({ startDay: '2026-11-28', startMin: 420, endMin: 540 });
  });
  it('all-day end is inclusive in the form, exclusive in storage', () => {
    const f = eventFieldsFromDraft({ ...d, allDay: true, endDay: '2026-11-30' }, TZ);
    expect(f).toMatchObject({ start: '2026-11-28', end: '2026-12-01' });
    const e = { ...f, id: 'x', createdAt: '', updatedAt: '', deletedAt: null } as CalendarEvent;
    expect(draftFromEvent(e, TZ).endDay).toBe('2026-11-30');
  });
});

describe('moving events', () => {
  it('addWallMinutes overflows into days', () => {
    expect(addWallMinutes('2026-11-28', 23 * 60, 120)).toEqual({ day: '2026-11-29', minutes: 60 });
    expect(addWallMinutes('2026-11-28', 30, -60)).toEqual({ day: '2026-11-27', minutes: 1410 });
  });
  it('shifts timed and all-day events keeping duration', () => {
    const f = eventFieldsFromDraft(d, TZ);
    const e = { ...f, id: 'x', createdAt: '', updatedAt: '', deletedAt: null } as CalendarEvent;
    expect(shiftEvent(e, TZ, 1440 + 30)).toEqual({ start: '2026-11-29T00:30:00.000Z', end: '2026-11-29T02:30:00.000Z' });
    const a = { ...eventFieldsFromDraft({ ...d, allDay: true }, TZ), id: 'y', createdAt: '', updatedAt: '', deletedAt: null } as CalendarEvent;
    expect(shiftEvent(a, TZ, -1440)).toEqual({ start: '2026-11-27', end: '2026-11-28' });
  });
});
