/**
 * JSON export / import. The format is versioned and documented in docs/DATA_MODEL.md
 * so data can always be moved to another system.
 *
 * Schema 1: settings, calendars, events. Schema 2: + tasks, recurrence fields on events.
 * Older files are accepted (missing arrays = empty).
 */
import type { Calendar, CalendarEvent, Settings, Task } from './types';
import { validateCalendar, validateEvent, validateTask } from './validate';

export const BACKUP_APP = 'luma-calendar';
export const BACKUP_SCHEMA = 2;

export interface BackupFile {
  app: typeof BACKUP_APP;
  schema: number;
  exportedAt: string;
  settings: Settings;
  calendars: Calendar[];
  events: CalendarEvent[];
  tasks?: Task[];
}

export function createBackup(
  settings: Settings,
  calendars: Calendar[],
  events: CalendarEvent[],
  tasks: Task[] = [],
  exportedAt = new Date().toISOString(),
): BackupFile {
  return { app: BACKUP_APP, schema: BACKUP_SCHEMA, exportedAt, settings, calendars, events, tasks };
}

export interface MergeResult {
  calendars: Calendar[];
  events: CalendarEvent[];
  tasks: Task[];
  stats: { added: number; updated: number; skipped: number; invalid: number };
}

export class BackupFormatError extends Error {}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupFormatError('not-json');
  }
  const d = data as Partial<BackupFile>;
  if (!d || d.app !== BACKUP_APP) throw new BackupFormatError('wrong-app');
  if (typeof d.schema !== 'number' || d.schema > BACKUP_SCHEMA) throw new BackupFormatError('unsupported-schema');
  if (!Array.isArray(d.calendars) || !Array.isArray(d.events)) throw new BackupFormatError('missing-data');
  if (d.tasks !== undefined && !Array.isArray(d.tasks)) throw new BackupFormatError('missing-data');
  return d as BackupFile;
}

/**
 * Merge imported records into existing ones by id. A record is replaced only when
 * the imported copy is newer (updatedAt), so importing the same file twice never
 * creates duplicates or overwrites newer local edits.
 */
export function mergeBackup(
  existing: {
    calendars: Record<string, Calendar>;
    events: Record<string, CalendarEvent>;
    tasks?: Record<string, Task>;
  },
  backup: BackupFile,
): MergeResult {
  const stats = { added: 0, updated: 0, skipped: 0, invalid: 0 };
  const calendars: Calendar[] = [];
  const events: CalendarEvent[] = [];
  const tasks: Task[] = [];

  for (const c of backup.calendars) {
    if (!c?.id || validateCalendar(c).length) {
      stats.invalid++;
      continue;
    }
    const cur = existing.calendars[c.id];
    if (!cur) {
      calendars.push({ ...c, isDefault: false });
      stats.added++;
    } else if (c.updatedAt > cur.updatedAt) {
      calendars.push({ ...c, isDefault: cur.isDefault });
      stats.updated++;
    } else stats.skipped++;
  }

  const knownCalendars = new Set([...Object.keys(existing.calendars), ...calendars.map((c) => c.id)]);
  const mergeOne = <T extends { id: string; updatedAt: string }>(item: T, cur: T | undefined, out: T[]) => {
    if (!cur) {
      out.push(item);
      stats.added++;
    } else if (item.updatedAt > cur.updatedAt) {
      out.push(item);
      stats.updated++;
    } else stats.skipped++;
  };

  for (const e of backup.events) {
    if (!e?.id || !knownCalendars.has(e.calendarId) || validateEvent(e).length) {
      stats.invalid++;
      continue;
    }
    mergeOne(e, existing.events[e.id], events);
  }
  for (const t of backup.tasks ?? []) {
    if (!t?.id || (t.calendarId && !knownCalendars.has(t.calendarId)) || validateTask(t).length) {
      stats.invalid++;
      continue;
    }
    mergeOne(t, existing.tasks?.[t.id], tasks);
  }
  return { calendars, events, tasks, stats };
}
