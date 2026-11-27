/**
 * Domain model. Every synced record shares BaseRecord so the sync layer (M3)
 * can be added without migrating existing local data:
 *  - ids are generated on the client (UUIDv7, time-ordered)
 *  - deletes are soft (deletedAt) so they can be undone and synced
 */
import type { Recurrence } from '../recurrence/recurrence';
import type { DayKey } from '../time/days';

export type ID = string;

export interface BaseRecord {
  id: ID;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Calendar extends BaseRecord {
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  visible: boolean;
  isDefault: boolean;
  archivedAt: string | null;
}

interface EventBase extends BaseRecord {
  calendarId: ID;
  title: string;
  description: string;
  location: string;
  /** Per-event color override; null = use the calendar color. */
  color: string | null;
  /** Repeat rule (series master only). Absent in schema-1 records = not recurring. */
  recurrence?: Recurrence | null;
  /** Occurrence days removed from the series (deleted single occurrences). */
  exdates?: DayKey[];
  /** Set on an "override": a single modified occurrence of a series. */
  recurrenceMasterId?: ID | null;
  /** The original occurrence day this override replaces. */
  recurrenceDay?: DayKey | null;
  /** Time block: the task this event schedules. */
  taskId?: ID | null;
  /** Reminder offsets in minutes before start (delivered from M4). */
  reminders?: number[];
  /** When the owner marked this event "done" (struck through in the views); null/absent = not done. */
  doneAt?: string | null;
}

/** Timed event: start/end are UTC instants (ISO); timeZone is the zone it was created in. */
export interface TimedEvent extends EventBase {
  allDay: false;
  start: string;
  end: string;
  timeZone: string;
}

/** All-day event: floating dates. `end` is exclusive (RFC 5545 style). */
export interface AllDayEvent extends EventBase {
  allDay: true;
  start: DayKey;
  end: DayKey;
  timeZone: null;
}

export type CalendarEvent = TimedEvent | AllDayEvent;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done' | 'cancelled';
/** 0 none · 1 low · 2 medium · 3 high */
export type Priority = 0 | 1 | 2 | 3;

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface Task extends BaseRecord {
  title: string;
  notes: string;
  /** Category (same "calendars" as events). null + no dates + no parent = Inbox. */
  calendarId: ID | null;
  /** Subtask of another task. */
  parentId: ID | null;
  status: TaskStatus;
  priority: Priority;
  startDay: DayKey | null;
  dueDay: DayKey | null;
  /** Optional due time (minutes since midnight, display zone). */
  dueMin: number | null;
  estimateMin: number | null;
  /** Manual progress 0–100; null = computed from subtasks/checklist. */
  progress: number | null;
  checklist: ChecklistItem[];
  tags: string[];
  links: string[];
  /** Repeat: completing the task moves dueDay to the next occurrence. */
  recurrence: Recurrence | null;
  /** History of completions (recurring and one-off). */
  completions: { at: string; dueDay: DayKey | null }[];
  completedAt: string | null;
  sortOrder: number;
  /** Preparation / post-production task of an event. */
  linkedEventId: ID | null;
  linkRole: 'prep' | 'post' | null;
  /** Reminder offsets in minutes before the due time (delivered from M4). */
  reminders?: number[];
}

export type WeekStart = 0 | 1 | 6;
export type TimeFormat = '24h' | '12h';
export type ThemePref = 'system' | 'light' | 'dark';
export type Locale = 'vi' | 'en';
export type ViewMode = 'day' | '3day' | 'week' | 'month' | 'agenda';

export interface Settings {
  /** Last time a synced setting changed (settings sync, last-writer-wins per field). */
  updatedAt?: string;
  locale: Locale;
  theme: ThemePref;
  timeZone: string;
  weekStart: WeekStart;
  timeFormat: TimeFormat;
  /** Minutes since midnight */
  workStart: number;
  workEnd: number;
  showWeekends: boolean;
  showLunar: boolean;
  showHolidays: boolean;
  defaultView: ViewMode;
  defaultDurationMin: number;
}
