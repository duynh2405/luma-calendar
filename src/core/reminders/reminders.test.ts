import { describe, expect, it } from 'vitest';

import type { CalendarEvent, Task } from '../model/types';
import { planReminders, reminderBody } from './reminders';

const TZ = 'Asia/Ho_Chi_Minh';
const base = { calendarId: 'c', description: '', location: '', color: null, createdAt: '', updatedAt: '', deletedAt: null };
const now = Date.parse('2026-11-27T01:00:00.000Z'); // 08:00 local

const ev = (o: Partial<CalendarEvent> & { id: string }): CalendarEvent =>
  ({ ...base, title: 'Họp', allDay: false, start: '2026-11-27T07:00:00.000Z', end: '2026-11-27T08:00:00.000Z', timeZone: TZ, ...o }) as CalendarEvent;

describe('planReminders', () => {
  it('fires before start, skips past, done and deleted', () => {
    const list = planReminders({
      events: [
        ev({ id: 'a', reminders: [30, 0] }),
        ev({ id: 'past', reminders: [10], start: '2026-11-27T00:00:00.000Z', end: '2026-11-27T00:30:00.000Z' }),
        ev({ id: 'done', reminders: [10], doneAt: '2026-11-27T00:00:00.000Z' }),
        ev({ id: 'del', reminders: [10], deletedAt: '2026-11-26T00:00:00.000Z' }),
        ev({ id: 'none' }),
      ],
      tasks: [],
      tz: TZ,
      nowMs: now,
    });
    expect(list.map((r) => [r.refId, r.offsetMin, r.fireAt])).toEqual([
      ['a', 30, '2026-11-27T06:30:00.000Z'],
      ['a', 0, '2026-11-27T07:00:00.000Z'],
    ]);
  });

  it('all-day events and tasks use 09:00 unless the task has a time', () => {
    const task = (o: Partial<Task> & { id: string }): Task =>
      ({ ...base, title: 'Báo giá', notes: '', parentId: null, status: 'todo', priority: 0, startDay: null, dueDay: '2026-11-28', dueMin: null, estimateMin: null, progress: null, checklist: [], tags: [], links: [], recurrence: null, completions: [], completedAt: null, sortOrder: 0, linkedEventId: null, linkRole: null, reminders: [60], ...o }) as Task;
    const list = planReminders({
      events: [ev({ id: 'ad', allDay: true, start: '2026-11-28', end: '2026-11-29', timeZone: null, reminders: [0] } as never)],
      tasks: [task({ id: 't1' }), task({ id: 't2', dueMin: 15 * 60 }), task({ id: 't3', status: 'done' })],
      tz: TZ,
      nowMs: now,
    });
    expect(list.map((r) => [r.refId, r.fireAt])).toEqual([
      ['t1', '2026-11-28T01:00:00.000Z'],
      ['ad', '2026-11-28T02:00:00.000Z'],
      ['t2', '2026-11-28T07:00:00.000Z'],
    ]);
  });

  it('expands recurring events with stable per-occurrence ids and honours the cap', () => {
    const rec = ev({ id: 'r', reminders: [10], recurrence: { freq: 'daily', interval: 1 }, start: '2026-11-28T02:00:00.000Z', end: '2026-11-28T03:00:00.000Z' });
    const list = planReminders({ events: [rec], tasks: [], tz: TZ, nowMs: now, limit: 5 });
    expect(list).toHaveLength(5);
    expect(new Set(list.map((r) => r.id)).size).toBe(5);
    expect(planReminders({ events: [rec], tasks: [], tz: TZ, nowMs: now, limit: 5 })[0].id).toBe(list[0].id);
  });

  it('writes a readable body', () => {
    const [r] = planReminders({ events: [ev({ id: 'a', reminders: [30] })], tasks: [], tz: TZ, nowMs: now });
    expect(reminderBody(r, 'vi', TZ)).toBe('Bắt đầu 14:00 (còn 30 phút)');
  });
});
