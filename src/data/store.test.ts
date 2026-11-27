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
