import { describe, expect, it } from 'vitest';

import { BackupFormatError, createBackup, mergeBackup, parseBackup } from './backup';
import { uuidv7 } from './id';
import type { Calendar, CalendarEvent, Settings } from './types';
import { validateEvent } from './validate';

const cal: Calendar = {
  id: 'cal-1',
  name: 'Media',
  color: '#3366cc',
  icon: 'camera',
  sortOrder: 0,
  visible: true,
  isDefault: true,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};
const ev: CalendarEvent = {
  id: 'ev-1',
  calendarId: 'cal-1',
  title: 'Quay đám cưới',
  description: '',
  location: '',
  color: null,
  allDay: false,
  start: '2026-11-28T01:00:00.000Z',
  end: '2026-11-28T05:00:00.000Z',
  timeZone: 'Asia/Ho_Chi_Minh',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};
const settings = {} as Settings;

describe('uuidv7', () => {
  it('has version 7 and sorts by time', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a[14]).toBe('7');
    expect(a < b).toBe(true);
    expect(new Set(Array.from({ length: 1000 }, () => uuidv7())).size).toBe(1000);
  });
});

describe('validateEvent', () => {
  it('accepts a valid event', () => expect(validateEvent(ev)).toEqual([]));
  it('rejects empty title and end before start', () => {
    expect(validateEvent({ ...ev, title: '  ', end: ev.start })).toEqual(['title-required', 'end-before-start']);
  });
  it('all-day end is exclusive', () => {
    const ad: CalendarEvent = { ...ev, allDay: true, start: '2026-11-28', end: '2026-11-28', timeZone: null };
    expect(validateEvent(ad)).toEqual(['end-before-start']);
  });
});

describe('backup', () => {
  it('round-trips and never duplicates on re-import', () => {
    const text = JSON.stringify(createBackup(settings, [cal], [ev]));
    const parsed = parseBackup(text);
    const first = mergeBackup({ calendars: {}, events: {} }, parsed);
    expect(first.stats).toMatchObject({ added: 2 });
    const again = mergeBackup({ calendars: { [cal.id]: cal }, events: { [ev.id]: ev } }, parsed);
    expect(again.stats).toMatchObject({ added: 0, updated: 0, skipped: 2 });
  });
  it('only newer records overwrite', () => {
    const newer = { ...ev, title: 'Mới', updatedAt: '2026-02-01T00:00:00.000Z' };
    const r = mergeBackup({ calendars: { [cal.id]: cal }, events: { [ev.id]: ev } }, createBackup(settings, [], [newer]));
    expect(r.stats.updated).toBe(1);
    expect(r.events[0].title).toBe('Mới');
  });
  it('rejects events whose calendar is unknown and invalid files', () => {
    const r = mergeBackup({ calendars: {}, events: {} }, createBackup(settings, [], [ev]));
    expect(r.stats.invalid).toBe(1);
    expect(() => parseBackup('{}')).toThrow(BackupFormatError);
    expect(() => parseBackup('nope')).toThrow(BackupFormatError);
  });
});
