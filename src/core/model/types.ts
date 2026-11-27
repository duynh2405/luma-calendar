/**
 * Domain model. Every synced record shares BaseRecord so the sync layer (M3)
 * can be added without migrating existing local data:
 *  - ids are generated on the client (UUIDv7, time-ordered)
 *  - deletes are soft (deletedAt) so they can be undone and synced
 */
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

export type WeekStart = 0 | 1 | 6;
export type TimeFormat = '24h' | '12h';
export type ThemePref = 'system' | 'light' | 'dark';
export type Locale = 'vi' | 'en';
export type ViewMode = 'day' | '3day' | 'week' | 'month' | 'agenda';

export interface Settings {
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
