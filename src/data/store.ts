/**
 * Local data store. Single source of truth for the UI; every mutation is
 * persisted immediately (one storage key per record) and recorded for Undo.
 *
 * Sync (M3) will hook in at `commit()`: each commit becomes an outbox entry.
 */
import { create } from 'zustand';

import { createBackup, mergeBackup, parseBackup, type BackupFile, type MergeResult } from '@/core/model/backup';
import { nowIso, uuidv7 } from '@/core/model/id';
import type { Calendar, CalendarEvent, ID, Settings } from '@/core/model/types';
import { validateCalendar, validateEvent } from '@/core/model/validate';
import { DEFAULT_TIME_ZONE } from '@/core/time/zone';

import { recordStorage } from './storage';
import { KEY, SCHEMA_VERSION } from './storage-types';

export const DEFAULT_SETTINGS: Settings = {
  locale: 'vi',
  theme: 'system',
  timeZone: DEFAULT_TIME_ZONE,
  weekStart: 1,
  timeFormat: '24h',
  workStart: 8 * 60,
  workEnd: 18 * 60,
  showWeekends: true,
  showLunar: true,
  showHolidays: true,
  defaultView: 'week',
  defaultDurationMin: 60,
};

export const CALENDAR_COLORS = [
  '#3B5BDB', '#1C7ED6', '#1098AD', '#0CA678', '#2F9E44', '#74B816', '#F59F00', '#F76707',
  '#E03131', '#C2255C', '#AE3EC9', '#7048E8', '#5C677D', '#8C6A4F', '#D9480F', '#0B7285',
] as const;

interface UndoEntry {
  label: string;
  /** Previous values by storage key; undefined = record didn't exist. */
  before: [string, Calendar | CalendarEvent | undefined][];
}

interface Change {
  calendars?: Calendar[];
  events?: CalendarEvent[];
  removeEvents?: ID[];
}

export type NewEvent = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type EventPatch = Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>;

interface DataState {
  loaded: boolean;
  storageError: string | null;
  settings: Settings;
  calendars: Record<ID, Calendar>;
  events: Record<ID, CalendarEvent>;
  undoStack: UndoEntry[];

  init(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;

  createCalendar(input: Pick<Calendar, 'name' | 'color' | 'icon'>): ID;
  updateCalendar(id: ID, patch: Partial<Pick<Calendar, 'name' | 'color' | 'icon' | 'visible'>>): void;
  setDefaultCalendar(id: ID): void;
  moveCalendar(id: ID, direction: -1 | 1): void;
  showOnlyCalendar(id: ID): void;
  setArchived(id: ID, archived: boolean): void;
  deleteCalendar(id: ID): void;
  restoreCalendar(id: ID): void;

  createEvent(input: NewEvent): ID;
  updateEvent(id: ID, patch: EventPatch, label?: string): void;
  duplicateEvent(id: ID): ID | null;
  deleteEvent(id: ID): void;
  restoreEvent(id: ID): void;
  purgeEvents(ids: ID[]): void;

  undo(): string | null;
  exportBackup(): BackupFile;
  importBackup(text: string): MergeResult['stats'];
}

let writeQueue: Promise<void> = Promise.resolve();

export const useData = create<DataState>((set, get) => {
  /** Apply a change, persist it, and push an undo entry. */
  function commit(label: string | null, change: Change) {
    const s = get();
    const before: UndoEntry['before'] = [];
    const calendars = { ...s.calendars };
    const events = { ...s.events };
    const puts: [string, unknown][] = [];
    const removes: string[] = [];

    for (const c of change.calendars ?? []) {
      before.push([KEY.calendar(c.id), s.calendars[c.id]]);
      calendars[c.id] = c;
      puts.push([KEY.calendar(c.id), c]);
    }
    for (const e of change.events ?? []) {
      before.push([KEY.event(e.id), s.events[e.id]]);
      events[e.id] = e;
      puts.push([KEY.event(e.id), e]);
    }
    for (const id of change.removeEvents ?? []) {
      before.push([KEY.event(id), s.events[id]]);
      delete events[id];
      removes.push(KEY.event(id));
    }

    set({
      calendars,
      events,
      undoStack: label ? [...s.undoStack.slice(-49), { label, before }] : s.undoStack,
    });
    persist(puts, removes);
  }

  function persist(puts: [string, unknown][], removes: string[]) {
    writeQueue = writeQueue
      .then(async () => {
        await recordStorage.putMany(puts);
        await recordStorage.removeMany(removes);
        if (get().storageError) set({ storageError: null });
      })
      .catch((err: unknown) => {
        set({ storageError: err instanceof Error ? err.message : String(err) });
      });
  }

  function touch<T extends Calendar | CalendarEvent>(r: T, patch: Partial<T>): T {
    return { ...r, ...patch, updatedAt: nowIso() };
  }

  function sortedCalendars(): Calendar[] {
    return Object.values(get().calendars).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return {
    loaded: false,
    storageError: null,
    settings: DEFAULT_SETTINGS,
    calendars: {},
    events: {},
    undoStack: [],

    async init() {
      if (get().loaded) return;
      let raw: Record<string, unknown> = {};
      try {
        raw = await recordStorage.loadAll();
      } catch (err) {
        set({ storageError: err instanceof Error ? err.message : String(err) });
      }
      const calendars: Record<ID, Calendar> = {};
      const events: Record<ID, CalendarEvent> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (k.startsWith('cal:')) calendars[k.slice(4)] = v as Calendar;
        else if (k.startsWith('evt:')) events[k.slice(4)] = v as CalendarEvent;
      }
      const settings = { ...DEFAULT_SETTINGS, ...((raw[KEY.settings] as Partial<Settings>) ?? {}) };
      set({ calendars, events, settings, loaded: true });

      if (!raw[KEY.meta]) persist([[KEY.meta, { schema: SCHEMA_VERSION, createdAt: nowIso() }]], []);
      // A calendar is needed to hold events. Created once, user can rename/delete it.
      if (Object.keys(calendars).length === 0) {
        const id = get().createCalendar({
          name: settings.locale === 'vi' ? 'Lịch của tôi' : 'My calendar',
          color: CALENDAR_COLORS[0],
          icon: 'calendar',
        });
        get().setDefaultCalendar(id);
        set({ undoStack: [] });
      }
      void recordStorage.requestPersistence();
    },

    updateSettings(patch) {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      persist([[KEY.settings, settings]], []);
    },

    createCalendar(input) {
      const id = uuidv7();
      const now = nowIso();
      const maxOrder = Math.max(-1, ...Object.values(get().calendars).map((c) => c.sortOrder));
      const cal: Calendar = {
        id,
        name: input.name.trim(),
        color: input.color,
        icon: input.icon,
        sortOrder: maxOrder + 1,
        visible: true,
        isDefault: false,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      if (validateCalendar(cal).length) throw new Error(validateCalendar(cal).join(','));
      commit('calendar-created', { calendars: [cal] });
      return id;
    },

    updateCalendar(id, patch) {
      const c = get().calendars[id];
      if (!c) return;
      const next = touch(c, { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) });
      if (validateCalendar(next).length) throw new Error(validateCalendar(next).join(','));
      commit(patch.visible !== undefined && Object.keys(patch).length === 1 ? null : 'calendar-updated', {
        calendars: [next],
      });
    },

    setDefaultCalendar(id) {
      const changed = sortedCalendars()
        .filter((c) => c.isDefault !== (c.id === id))
        .map((c) => touch(c, { isDefault: c.id === id }));
      if (changed.length) commit(null, { calendars: changed });
    },

    moveCalendar(id, direction) {
      const list = sortedCalendars().filter((c) => !c.deletedAt);
      const i = list.findIndex((c) => c.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= list.length) return;
      const a = list[i];
      const b = list[j];
      commit('calendar-reordered', {
        calendars: [touch(a, { sortOrder: b.sortOrder }), touch(b, { sortOrder: a.sortOrder })],
      });
    },

    showOnlyCalendar(id) {
      const changed = sortedCalendars()
        .filter((c) => c.visible !== (c.id === id))
        .map((c) => touch(c, { visible: c.id === id }));
      if (changed.length) commit(null, { calendars: changed });
    },

    setArchived(id, archived) {
      const c = get().calendars[id];
      if (!c) return;
      commit(archived ? 'calendar-archived' : 'calendar-unarchived', {
        calendars: [touch(c, { archivedAt: archived ? nowIso() : null })],
      });
    },

    deleteCalendar(id) {
      const c = get().calendars[id];
      if (!c) return;
      const now = nowIso();
      // Events of a deleted calendar go to the trash with it.
      const evts = Object.values(get().events)
        .filter((e) => e.calendarId === id && !e.deletedAt)
        .map((e) => touch(e, { deletedAt: now }));
      const next: Calendar[] = [touch(c, { deletedAt: now, isDefault: false })];
      if (c.isDefault) {
        const other = sortedCalendars().find((x) => x.id !== id && !x.deletedAt && !x.archivedAt);
        if (other) next.push(touch(other, { isDefault: true }));
      }
      commit('calendar-deleted', { calendars: next, events: evts });
    },

    restoreCalendar(id) {
      const c = get().calendars[id];
      if (!c?.deletedAt) return;
      const deletedAt = c.deletedAt;
      const evts = Object.values(get().events)
        .filter((e) => e.calendarId === id && e.deletedAt === deletedAt)
        .map((e) => touch(e, { deletedAt: null }));
      commit('calendar-restored', { calendars: [touch(c, { deletedAt: null })], events: evts });
    },

    createEvent(input) {
      const id = uuidv7();
      const now = nowIso();
      const e = { ...input, id, createdAt: now, updatedAt: now, deletedAt: null } as CalendarEvent;
      const errors = validateEvent(e);
      if (errors.length) throw new Error(errors.join(','));
      commit('event-created', { events: [e] });
      return id;
    },

    updateEvent(id, patch, label = 'event-updated') {
      const e = get().events[id];
      if (!e) return;
      const next = touch(e, patch as Partial<CalendarEvent>);
      const errors = validateEvent(next);
      if (errors.length) throw new Error(errors.join(','));
      commit(label, { events: [next] });
    },

    duplicateEvent(id) {
      const e = get().events[id];
      if (!e) return null;
      const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = e;
      const newId = get().createEvent(rest);
      // Replace the generic undo label.
      const stack = get().undoStack;
      stack[stack.length - 1].label = 'event-duplicated';
      return newId;
    },

    deleteEvent(id) {
      const e = get().events[id];
      if (!e) return;
      commit('event-deleted', { events: [touch(e, { deletedAt: nowIso() })] });
    },

    restoreEvent(id) {
      const e = get().events[id];
      if (!e) return;
      const cal = get().calendars[e.calendarId];
      const events = [touch(e, { deletedAt: null })];
      const calendars = cal?.deletedAt ? [touch(cal, { deletedAt: null })] : [];
      commit('event-restored', { events, calendars });
    },

    purgeEvents(ids) {
      commit('event-purged', { removeEvents: ids.filter((id) => get().events[id]?.deletedAt) });
    },

    undo() {
      const s = get();
      const entry = s.undoStack[s.undoStack.length - 1];
      if (!entry) return null;
      const calendars = { ...s.calendars };
      const events = { ...s.events };
      const puts: [string, unknown][] = [];
      const removes: string[] = [];
      for (const [key, prev] of [...entry.before].reverse()) {
        const id = key.slice(4);
        const target = key.startsWith('cal:') ? calendars : events;
        if (prev === undefined) {
          delete target[id];
          removes.push(key);
        } else {
          (target as Record<string, unknown>)[id] = prev;
          puts.push([key, prev]);
        }
      }
      set({ calendars, events, undoStack: s.undoStack.slice(0, -1) });
      persist(puts, removes);
      return entry.label;
    },

    exportBackup() {
      const s = get();
      return createBackup(s.settings, Object.values(s.calendars), Object.values(s.events));
    },

    importBackup(text) {
      const backup = parseBackup(text);
      const s = get();
      const result = mergeBackup({ calendars: s.calendars, events: s.events }, backup);
      if (result.calendars.length || result.events.length) {
        commit('backup-imported', { calendars: result.calendars, events: result.events });
      }
      return result.stats;
    },
  };
});

// --- Selectors --------------------------------------------------------------

export function activeCalendars(calendars: Record<ID, Calendar>): Calendar[] {
  return Object.values(calendars)
    .filter((c) => !c.deletedAt && !c.archivedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function defaultCalendarId(calendars: Record<ID, Calendar>): ID | null {
  const list = activeCalendars(calendars);
  return (list.find((c) => c.isDefault) ?? list[0])?.id ?? null;
}

/** Events that should be displayed: not deleted, in a visible, active calendar. */
export function visibleEvents(calendars: Record<ID, Calendar>, events: Record<ID, CalendarEvent>): CalendarEvent[] {
  return Object.values(events).filter((e) => {
    if (e.deletedAt) return false;
    const c = calendars[e.calendarId];
    return !!c && c.visible && !c.deletedAt && !c.archivedAt;
  });
}

export function eventColor(e: CalendarEvent, calendars: Record<ID, Calendar>): string {
  return e.color ?? calendars[e.calendarId]?.color ?? CALENDAR_COLORS[0];
}
