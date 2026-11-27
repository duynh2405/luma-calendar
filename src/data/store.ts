/**
 * Local data store. Single source of truth for the UI; every mutation is
 * persisted immediately (one storage key per record) and recorded for Undo.
 *
 * Sync (M3) will hook in at `commit()`: each commit becomes an outbox entry.
 */
import { create } from 'zustand';

import { createBackup, mergeBackup, parseBackup, type BackupFile, type MergeResult } from '@/core/model/backup';
import { nowIso, uuidv7 } from '@/core/model/id';
import type { Calendar, CalendarEvent, ID, Settings, Task } from '@/core/model/types';
import { validateCalendar, validateEvent, validateTask } from '@/core/model/validate';
import { deleteOccurrence, editOccurrence, type EditScope, type EventContent } from '@/core/recurrence/edit';
import { completeTask, reopenTask } from '@/core/tasks/tasks';
import { DEFAULT_TIME_ZONE, todayKey } from '@/core/time/zone';

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

type AnyRecord = Calendar | CalendarEvent | Task;

interface UndoEntry {
  label: string;
  /** Previous values by storage key; undefined = record didn't exist. */
  before: [string, AnyRecord | undefined][];
}

interface Change {
  calendars?: Calendar[];
  events?: CalendarEvent[];
  tasks?: Task[];
  removeEvents?: ID[];
  removeTasks?: ID[];
}

export type NewEvent = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type EventPatch = Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>;
export type NewTask = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>> & { title: string };
export type TaskPatch = Partial<Omit<Task, 'id' | 'createdAt'>>;

/** Identifies an occurrence of a (possibly recurring) event. */
export interface OccurrenceRef {
  masterId: ID;
  occurrenceDay: string | null;
}

interface DataState {
  loaded: boolean;
  storageError: string | null;
  settings: Settings;
  calendars: Record<ID, Calendar>;
  events: Record<ID, CalendarEvent>;
  tasks: Record<ID, Task>;
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
  /** Edit an occurrence of a recurring series with a scope. */
  updateOccurrence(ref: OccurrenceRef, scope: EditScope, content: EventContent, label?: string): void;
  deleteOccurrence(ref: OccurrenceRef, scope: EditScope): void;
  duplicateEvent(id: ID): ID | null;
  deleteEvent(id: ID): void;
  restoreEvent(id: ID): void;
  purgeEvents(ids: ID[]): void;

  createTask(input: NewTask): ID;
  updateTask(id: ID, patch: TaskPatch, label?: string): void;
  toggleTaskDone(id: ID): void;
  deleteTask(id: ID): void;
  restoreTask(id: ID): void;
  purgeTasks(ids: ID[]): void;
  /** Time-block a task: an event linked to it (the task's due date is kept). */
  scheduleTask(id: ID, start: string, end: string, timeZone: string): ID | null;

  undo(): string | null;
  exportBackup(): BackupFile;
  importBackup(text: string): MergeResult['stats'];
}

let writeQueue: Promise<void> = Promise.resolve();

const PREFIX = { cal: 'calendars', evt: 'events', task: 'tasks' } as const;
type Table = (typeof PREFIX)[keyof typeof PREFIX];

function tableOf(key: string): { table: Table; id: string } {
  const i = key.indexOf(':');
  return { table: PREFIX[key.slice(0, i) as keyof typeof PREFIX], id: key.slice(i + 1) };
}

export const useData = create<DataState>((set, get) => {
  /** Apply a change, persist it, and push an undo entry. */
  function commit(label: string | null, change: Change) {
    const s = get();
    const before: UndoEntry['before'] = [];
    const next = { calendars: { ...s.calendars }, events: { ...s.events }, tasks: { ...s.tasks } };
    const puts: [string, unknown][] = [];
    const removes: string[] = [];
    const put = <T extends AnyRecord>(table: Table, key: string, r: T) => {
      before.push([key, (s[table] as Record<string, AnyRecord>)[r.id]]);
      (next[table] as Record<string, AnyRecord>)[r.id] = r;
      puts.push([key, r]);
    };
    for (const c of change.calendars ?? []) put('calendars', KEY.calendar(c.id), c);
    for (const e of change.events ?? []) put('events', KEY.event(e.id), e);
    for (const t of change.tasks ?? []) put('tasks', KEY.task(t.id), t);
    for (const id of change.removeEvents ?? []) {
      before.push([KEY.event(id), s.events[id]]);
      delete next.events[id];
      removes.push(KEY.event(id));
    }
    for (const id of change.removeTasks ?? []) {
      before.push([KEY.task(id), s.tasks[id]]);
      delete next.tasks[id];
      removes.push(KEY.task(id));
    }
    set({ ...next, undoStack: label ? [...s.undoStack.slice(-49), { label, before }] : s.undoStack });
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

  function touch<T extends AnyRecord>(r: T, patch: Partial<T>): T {
    return { ...r, ...patch, updatedAt: nowIso() };
  }

  function sortedCalendars(): Calendar[] {
    return Object.values(get().calendars).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function checkEvents(list: CalendarEvent[]) {
    for (const e of list) {
      if (e.deletedAt) continue;
      const errors = validateEvent(e);
      if (errors.length) throw new Error(errors.join(','));
    }
  }

  /** Task and all its (nested) subtasks. */
  function withSubtasks(id: ID): Task[] {
    const all = Object.values(get().tasks);
    const out: Task[] = [];
    const walk = (pid: ID) => {
      for (const t of all) if (t.parentId === pid) {
        out.push(t);
        walk(t.id);
      }
    };
    const root = get().tasks[id];
    if (root) out.push(root);
    walk(id);
    return out;
  }

  return {
    loaded: false,
    storageError: null,
    settings: DEFAULT_SETTINGS,
    calendars: {},
    events: {},
    tasks: {},
    undoStack: [],

    async init() {
      if (get().loaded) return;
      let raw: Record<string, unknown> = {};
      try {
        raw = await recordStorage.loadAll();
      } catch (err) {
        set({ storageError: err instanceof Error ? err.message : String(err) });
      }
      const data = { calendars: {} as Record<ID, Calendar>, events: {} as Record<ID, CalendarEvent>, tasks: {} as Record<ID, Task> };
      for (const [k, v] of Object.entries(raw)) {
        if (!k.includes(':')) continue;
        const { table, id } = tableOf(k);
        if (table) (data[table] as Record<string, unknown>)[id] = v;
      }
      const settings = { ...DEFAULT_SETTINGS, ...((raw[KEY.settings] as Partial<Settings>) ?? {}) };
      set({ ...data, settings, loaded: true });

      const meta = raw[KEY.meta] as { schema?: number; createdAt?: string } | undefined;
      // Schema 1 → 2 is additive (optional fields), no data rewrite needed.
      if (!meta || (meta.schema ?? 0) < SCHEMA_VERSION) {
        persist([[KEY.meta, { schema: SCHEMA_VERSION, createdAt: meta?.createdAt ?? nowIso() }]], []);
      }
      // A calendar is needed to hold events. Created once, user can rename/delete it.
      if (Object.keys(data.calendars).length === 0) {
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

    // --- calendars -------------------------------------------------------------------------

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
      // Events and tasks of a deleted calendar go to the trash with it.
      const evts = Object.values(get().events)
        .filter((e) => e.calendarId === id && !e.deletedAt)
        .map((e) => touch(e, { deletedAt: now }));
      const tasks = Object.values(get().tasks)
        .filter((t) => t.calendarId === id && !t.deletedAt)
        .map((t) => touch(t, { deletedAt: now }));
      const next: Calendar[] = [touch(c, { deletedAt: now, isDefault: false })];
      if (c.isDefault) {
        const other = sortedCalendars().find((x) => x.id !== id && !x.deletedAt && !x.archivedAt);
        if (other) next.push(touch(other, { isDefault: true }));
      }
      commit('calendar-deleted', { calendars: next, events: evts, tasks });
    },

    restoreCalendar(id) {
      const c = get().calendars[id];
      if (!c?.deletedAt) return;
      const deletedAt = c.deletedAt;
      const evts = Object.values(get().events)
        .filter((e) => e.calendarId === id && e.deletedAt === deletedAt)
        .map((e) => touch(e, { deletedAt: null }));
      const tasks = Object.values(get().tasks)
        .filter((t) => t.calendarId === id && t.deletedAt === deletedAt)
        .map((t) => touch(t, { deletedAt: null }));
      commit('calendar-restored', { calendars: [touch(c, { deletedAt: null })], events: evts, tasks });
    },

    // --- events --------------------------------------------------------------------------------

    createEvent(input) {
      const id = uuidv7();
      const now = nowIso();
      const e = { ...input, id, createdAt: now, updatedAt: now, deletedAt: null } as CalendarEvent;
      checkEvents([e]);
      commit('event-created', { events: [e] });
      return id;
    },

    updateEvent(id, patch, label = 'event-updated') {
      const e = get().events[id];
      if (!e) return;
      const next = touch(e, patch as Partial<CalendarEvent>);
      checkEvents([next]);
      commit(label, { events: [next] });
    },

    updateOccurrence(ref, scope, content, label = 'event-updated') {
      const master = get().events[ref.masterId];
      if (!master) return;
      if (!master.recurrence || !ref.occurrenceDay) {
        get().updateEvent(master.id, content as EventPatch, label);
        return;
      }
      const { upsert } = editOccurrence(scope, master, ref.occurrenceDay, content, {
        now: nowIso(),
        newId: uuidv7,
        events: Object.values(get().events),
      });
      checkEvents(upsert);
      commit(label, { events: upsert });
    },

    deleteOccurrence(ref, scope) {
      const master = get().events[ref.masterId];
      if (!master) return;
      if (!master.recurrence || !ref.occurrenceDay) {
        get().deleteEvent(master.id);
        return;
      }
      const { upsert } = deleteOccurrence(scope, master, ref.occurrenceDay, {
        now: nowIso(),
        newId: uuidv7,
        events: Object.values(get().events),
      });
      commit('event-deleted', { events: upsert });
    },

    duplicateEvent(id) {
      const e = get().events[id];
      if (!e) return null;
      const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, recurrenceMasterId: _m, recurrenceDay: _r, ...rest } = e;
      const newId = uuidv7();
      const now = nowIso();
      const copy = { ...rest, id: newId, createdAt: now, updatedAt: now, deletedAt: null } as CalendarEvent;
      checkEvents([copy]);
      commit('event-duplicated', { events: [copy] });
      return newId;
    },

    deleteEvent(id) {
      const e = get().events[id];
      if (!e) return;
      const now = nowIso();
      const changes: CalendarEvent[] = [touch(e, { deletedAt: now })];
      // Deleting a single modified occurrence must not bring the original occurrence back.
      const master = e.recurrenceMasterId ? get().events[e.recurrenceMasterId] : undefined;
      if (master && e.recurrenceDay) {
        changes.push(touch(master, { exdates: Array.from(new Set([...(master.exdates ?? []), e.recurrenceDay])).sort() }));
      }
      // Deleting a series also removes its modified occurrences.
      if (e.recurrence) {
        for (const o of Object.values(get().events)) {
          if (o.recurrenceMasterId === id && !o.deletedAt) changes.push(touch(o, { deletedAt: now }));
        }
      }
      commit('event-deleted', { events: changes });
    },

    restoreEvent(id) {
      const e = get().events[id];
      if (!e) return;
      const cal = get().calendars[e.calendarId];
      const events = [touch(e, { deletedAt: null })];
      const master = e.recurrenceMasterId ? get().events[e.recurrenceMasterId] : undefined;
      if (master && e.recurrenceDay && master.exdates?.includes(e.recurrenceDay)) {
        events.push(touch(master, { exdates: master.exdates.filter((d) => d !== e.recurrenceDay) }));
      }
      const calendars = cal?.deletedAt ? [touch(cal, { deletedAt: null })] : [];
      commit('event-restored', { events, calendars });
    },

    purgeEvents(ids) {
      commit('event-purged', { removeEvents: ids.filter((id) => get().events[id]?.deletedAt) });
    },

    // --- tasks ---------------------------------------------------------------------------------

    createTask(input) {
      const id = uuidv7();
      const now = nowIso();
      const siblings = Object.values(get().tasks).filter((t) => t.parentId === (input.parentId ?? null));
      const task: Task = {
        notes: '',
        calendarId: null,
        parentId: null,
        status: 'todo',
        priority: 0,
        startDay: null,
        dueDay: null,
        dueMin: null,
        estimateMin: null,
        progress: null,
        checklist: [],
        tags: [],
        links: [],
        recurrence: null,
        completions: [],
        completedAt: null,
        sortOrder: Math.max(-1, ...siblings.map((t) => t.sortOrder)) + 1,
        linkedEventId: null,
        linkRole: null,
        ...input,
        title: input.title.trim(),
        id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const errors = validateTask(task);
      if (errors.length) throw new Error(errors.join(','));
      commit('task-created', { tasks: [task] });
      return id;
    },

    updateTask(id, patch, label = 'task-updated') {
      const t = get().tasks[id];
      if (!t) return;
      const next = touch(t, patch as Partial<Task>);
      const errors = validateTask(next);
      if (errors.length) throw new Error(errors.join(','));
      commit(label, { tasks: [next] });
    },

    toggleTaskDone(id) {
      const t = get().tasks[id];
      if (!t) return;
      const now = nowIso();
      const next = t.status === 'done' ? reopenTask(t, now) : completeTask(t, now, todayKey(get().settings.timeZone));
      commit(t.status === 'done' ? 'task-reopened' : 'task-completed', { tasks: [next] });
    },

    deleteTask(id) {
      const now = nowIso();
      const list = withSubtasks(id).filter((t) => !t.deletedAt).map((t) => touch(t, { deletedAt: now }));
      if (list.length) commit('task-deleted', { tasks: list });
    },

    restoreTask(id) {
      const t = get().tasks[id];
      if (!t?.deletedAt) return;
      const at = t.deletedAt;
      const list = withSubtasks(id).filter((x) => x.deletedAt === at).map((x) => touch(x, { deletedAt: null }));
      const cal = t.calendarId ? get().calendars[t.calendarId] : undefined;
      commit('task-restored', { tasks: list, calendars: cal?.deletedAt ? [touch(cal, { deletedAt: null })] : [] });
    },

    purgeTasks(ids) {
      commit('task-purged', { removeTasks: ids.filter((id) => get().tasks[id]?.deletedAt) });
    },

    scheduleTask(id, start, end, timeZone) {
      const t = get().tasks[id];
      if (!t) return null;
      const calendarId = t.calendarId ?? defaultCalendarId(get().calendars);
      if (!calendarId) return null;
      const eventId = uuidv7();
      const now = nowIso();
      const e: CalendarEvent = {
        id: eventId,
        calendarId,
        title: t.title,
        description: '',
        location: '',
        color: null,
        allDay: false,
        start,
        end,
        timeZone,
        taskId: id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      checkEvents([e]);
      commit('task-scheduled', { events: [e] });
      return eventId;
    },

    // --- undo & backup --------------------------------------------------------------------

    undo() {
      const s = get();
      const entry = s.undoStack[s.undoStack.length - 1];
      if (!entry) return null;
      const next = { calendars: { ...s.calendars }, events: { ...s.events }, tasks: { ...s.tasks } };
      const puts: [string, unknown][] = [];
      const removes: string[] = [];
      for (const [key, prev] of [...entry.before].reverse()) {
        const { table, id } = tableOf(key);
        const target = next[table] as Record<string, unknown>;
        if (prev === undefined) {
          delete target[id];
          removes.push(key);
        } else {
          target[id] = prev;
          puts.push([key, prev]);
        }
      }
      set({ ...next, undoStack: s.undoStack.slice(0, -1) });
      persist(puts, removes);
      return entry.label;
    },

    exportBackup() {
      const s = get();
      return createBackup(s.settings, Object.values(s.calendars), Object.values(s.events), Object.values(s.tasks));
    },

    importBackup(text) {
      const backup = parseBackup(text);
      const s = get();
      const result = mergeBackup({ calendars: s.calendars, events: s.events, tasks: s.tasks }, backup);
      if (result.calendars.length || result.events.length || result.tasks.length) {
        commit('backup-imported', { calendars: result.calendars, events: result.events, tasks: result.tasks });
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

function calendarShown(calendars: Record<ID, Calendar>, id: ID | null): boolean {
  if (!id) return true;
  const c = calendars[id];
  return !!c && c.visible && !c.deletedAt && !c.archivedAt;
}

/** Events that should be displayed: not deleted, in a visible, active calendar. */
export function visibleEvents(calendars: Record<ID, Calendar>, events: Record<ID, CalendarEvent>): CalendarEvent[] {
  return Object.values(events).filter((e) => !e.deletedAt && calendarShown(calendars, e.calendarId));
}

/** Tasks not deleted whose category is shown (tasks without a category are always shown). */
export function visibleTasks(calendars: Record<ID, Calendar>, tasks: Record<ID, Task>): Task[] {
  return Object.values(tasks).filter((t) => !t.deletedAt && calendarShown(calendars, t.calendarId));
}

export function eventColor(e: CalendarEvent, calendars: Record<ID, Calendar>): string {
  return e.color ?? calendars[e.calendarId]?.color ?? CALENDAR_COLORS[0];
}

export function taskColor(t: Task, calendars: Record<ID, Calendar>): string {
  return (t.calendarId && calendars[t.calendarId]?.color) || '#868E96';
}
