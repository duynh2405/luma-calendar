/**
 * JSON export / import. The format is versioned and documented in docs/DATA_MODEL.md
 * so data can always be moved to another system.
 */
import type { Calendar, CalendarEvent, Settings } from './types';
import { validateCalendar, validateEvent } from './validate';

export const BACKUP_APP = 'luma-calendar';
export const BACKUP_SCHEMA = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  schema: number;
  exportedAt: string;
  settings: Settings;
  calendars: Calendar[];
  events: CalendarEvent[];
}

export function createBackup(
  settings: Settings,
  calendars: Calendar[],
  events: CalendarEvent[],
  exportedAt = new Date().toISOString(),
): BackupFile {
  return { app: BACKUP_APP, schema: BACKUP_SCHEMA, exportedAt, settings, calendars, events };
}

export interface MergeResult {
  calendars: Calendar[];
  events: CalendarEvent[];
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
  return d as BackupFile;
}

/**
 * Merge imported records into existing ones by id. A record is replaced only when
 * the imported copy is newer (updatedAt), so importing the same file twice never
 * creates duplicates or overwrites newer local edits.
 */
export function mergeBackup(
  existing: { calendars: Record<string, Calendar>; events: Record<string, CalendarEvent> },
  backup: BackupFile,
): MergeResult {
  const stats = { added: 0, updated: 0, skipped: 0, invalid: 0 };
  const calendars: Calendar[] = [];
  const events: CalendarEvent[] = [];

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
  for (const e of backup.events) {
    if (!e?.id || !knownCalendars.has(e.calendarId) || validateEvent(e).length) {
      stats.invalid++;
      continue;
    }
    const cur = existing.events[e.id];
    if (!cur) {
      events.push(e);
      stats.added++;
    } else if (e.updatedAt > cur.updatedAt) {
      events.push(e);
      stats.updated++;
    } else stats.skipped++;
  }
  return { calendars, events, stats };
}
