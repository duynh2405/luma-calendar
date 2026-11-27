import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = new Map<string, unknown>();
vi.mock('./storage', () => ({
  recordStorage: {
    loadAll: async () => Object.fromEntries(disk),
    putMany: async (list: [string, unknown][]) => list.forEach(([k, v]) => disk.set(k, structuredClone(v))),
    removeMany: async (keys: string[]) => keys.forEach((k) => disk.delete(k)),
    requestPersistence: async () => true,
  },
}));

const { useData, visibleEvents } = await import('./store');

const flush = () => new Promise((r) => setTimeout(r, 0));

const timed = (calendarId: string, title = 'Họp khách') => ({
  calendarId,
  title,
  description: '',
  location: '',
  color: null,
  allDay: false as const,
  start: '2026-11-28T01:00:00.000Z',
  end: '2026-11-28T02:00:00.000Z',
  timeZone: 'Asia/Ho_Chi_Minh',
});

beforeEach(async () => {
  disk.clear();
  useData.setState({ loaded: false, calendars: {}, events: {}, undoStack: [] });
  await useData.getState().init();
});

describe('store', () => {
  it('first run creates exactly one default calendar and no events', () => {
    const cals = Object.values(useData.getState().calendars);
    expect(cals).toHaveLength(1);
    expect(cals[0].isDefault).toBe(true);
    expect(Object.keys(useData.getState().events)).toHaveLength(0);
  });

  it('persists every change and reloads it', async () => {
    const s = useData.getState();
    const calId = Object.keys(s.calendars)[0];
    const id = s.createEvent(timed(calId));
    await flush();
    useData.setState({ loaded: false, calendars: {}, events: {} });
    await useData.getState().init();
    expect(useData.getState().events[id].title).toBe('Họp khách');
  });

  it('delete → trash → undo restores', () => {
    const s = useData.getState();
    const calId = Object.keys(s.calendars)[0];
    const id = s.createEvent(timed(calId));
    s.deleteEvent(id);
    let st = useData.getState();
    expect(st.events[id].deletedAt).not.toBeNull();
    expect(visibleEvents(st.calendars, st.events)).toHaveLength(0);
    expect(st.undo()).toBe('event-deleted');
    st = useData.getState();
    expect(st.events[id].deletedAt).toBeNull();
  });

  it('undo of create removes the record from disk', async () => {
    const s = useData.getState();
    const calId = Object.keys(s.calendars)[0];
    const id = s.createEvent(timed(calId));
    await flush();
    expect(disk.has(`evt:${id}`)).toBe(true);
    useData.getState().undo();
    await flush();
    expect(disk.has(`evt:${id}`)).toBe(false);
  });

  it('deleting a calendar trashes its events and moves the default', () => {
    const s = useData.getState();
    const first = Object.keys(s.calendars)[0];
    const second = s.createCalendar({ name: 'Media', color: '#1C7ED6', icon: 'camera' });
    const id = s.createEvent(timed(first));
    useData.getState().deleteCalendar(first);
    let st = useData.getState();
    expect(st.events[id].deletedAt).not.toBeNull();
    expect(st.calendars[second].isDefault).toBe(true);
    st.restoreCalendar(first);
    st = useData.getState();
    expect(st.events[id].deletedAt).toBeNull();
  });

  it('rejects invalid events', () => {
    const calId = Object.keys(useData.getState().calendars)[0];
    expect(() => useData.getState().createEvent({ ...timed(calId), title: '' })).toThrow();
  });

  it('import of an export never duplicates', () => {
    const s = useData.getState();
    const calId = Object.keys(s.calendars)[0];
    s.createEvent(timed(calId));
    const text = JSON.stringify(useData.getState().exportBackup());
    const stats = useData.getState().importBackup(text);
    expect(stats).toMatchObject({ added: 0, skipped: 2 });
    expect(Object.keys(useData.getState().events)).toHaveLength(1);
  });

  it('tasks: create, complete, recurring task advances, delete with subtasks, undo', () => {
    const s = useData.getState();
    const id = s.createTask({ title: 'Dựng video', dueDay: '2026-11-30' });
    const sub = useData.getState().createTask({ title: 'Chọn nhạc', parentId: id });
    useData.getState().toggleTaskDone(id);
    expect(useData.getState().tasks[id].status).toBe('done');
    useData.getState().toggleTaskDone(id);
    expect(useData.getState().tasks[id].status).toBe('todo');

    const rec = useData.getState().createTask({
      title: 'Báo cáo tuần',
      dueDay: '2026-11-27',
      recurrence: { freq: 'weekly', interval: 1 },
    });
    useData.getState().toggleTaskDone(rec);
    const r = useData.getState().tasks[rec];
    expect(r.status).toBe('todo');
    expect(r.dueDay! > '2026-11-27').toBe(true);
    expect(r.completions).toHaveLength(1);

    useData.getState().deleteTask(id);
    expect(useData.getState().tasks[sub].deletedAt).not.toBeNull();
    useData.getState().undo();
    expect(useData.getState().tasks[sub].deletedAt).toBeNull();
    expect(() => useData.getState().createTask({ title: ' ' })).toThrow();
  });

  it('recurring events: delete one occurrence, edit following, delete override keeps it gone', () => {
    const calId = Object.keys(useData.getState().calendars)[0];
    const id = useData.getState().createEvent({ ...timed(calId), recurrence: { freq: 'daily', interval: 1 } });
    useData.getState().deleteOccurrence({ masterId: id, occurrenceDay: '2026-11-29' }, 'this');
    expect(useData.getState().events[id].exdates).toEqual(['2026-11-29']);

    const { id: _i, createdAt: _c, updatedAt: _u, deletedAt: _d, recurrence: _r, exdates: _x, ...content } = useData.getState().events[id];
    useData.getState().updateOccurrence({ masterId: id, occurrenceDay: '2026-11-30' }, 'this', { ...content, title: 'Đổi' });
    const override = Object.values(useData.getState().events).find((e) => e.recurrenceMasterId === id)!;
    expect(override.recurrenceDay).toBe('2026-11-30');
    useData.getState().deleteEvent(override.id);
    expect(useData.getState().events[id].exdates).toEqual(['2026-11-29', '2026-11-30']);
  });

  it('scheduleTask creates a linked time block and keeps the due date', () => {
    const t = useData.getState().createTask({ title: 'Sửa ảnh', dueDay: '2026-12-01' });
    const e = useData.getState().scheduleTask(t, '2026-11-28T02:00:00.000Z', '2026-11-28T04:00:00.000Z', 'Asia/Ho_Chi_Minh');
    expect(useData.getState().events[e!].taskId).toBe(t);
    expect(useData.getState().tasks[t].dueDay).toBe('2026-12-01');
  });

  it('purge only removes trashed events', () => {
    const s = useData.getState();
    const calId = Object.keys(s.calendars)[0];
    const a = s.createEvent(timed(calId, 'A'));
    const b = s.createEvent(timed(calId, 'B'));
    useData.getState().deleteEvent(a);
    useData.getState().purgeEvents([a, b]);
    const st = useData.getState();
    expect(st.events[a]).toBeUndefined();
    expect(st.events[b]).toBeDefined();
  });
});
