import type { Calendar, CalendarEvent, Task } from './types';

export const LIMITS = {
  calendarName: 60,
  title: 200,
  location: 300,
  description: 10_000,
} as const;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export type ValidationError =
  | 'title-required'
  | 'title-too-long'
  | 'location-too-long'
  | 'description-too-long'
  | 'end-before-start'
  | 'invalid-date'
  | 'invalid-color'
  | 'name-required'
  | 'name-too-long';

export function validateEvent(e: CalendarEvent): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!e.title.trim()) errors.push('title-required');
  if (e.title.length > LIMITS.title) errors.push('title-too-long');
  if (e.location.length > LIMITS.location) errors.push('location-too-long');
  if (e.description.length > LIMITS.description) errors.push('description-too-long');
  if (e.color !== null && !COLOR_RE.test(e.color)) errors.push('invalid-color');
  if (e.allDay) {
    if (!DAY_RE.test(e.start) || !DAY_RE.test(e.end)) errors.push('invalid-date');
    else if (e.end <= e.start) errors.push('end-before-start');
  } else {
    const s = Date.parse(e.start);
    const en = Date.parse(e.end);
    if (Number.isNaN(s) || Number.isNaN(en)) errors.push('invalid-date');
    else if (en <= s) errors.push('end-before-start');
  }
  return errors;
}

export function validateTask(t: Task): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!t.title.trim()) errors.push('title-required');
  if (t.title.length > LIMITS.title) errors.push('title-too-long');
  if (t.notes.length > LIMITS.description) errors.push('description-too-long');
  if ((t.dueDay && !DAY_RE.test(t.dueDay)) || (t.startDay && !DAY_RE.test(t.startDay))) errors.push('invalid-date');
  else if (t.startDay && t.dueDay && t.dueDay < t.startDay) errors.push('end-before-start');
  return errors;
}

export function validateCalendar(c: Calendar): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!c.name.trim()) errors.push('name-required');
  if (c.name.length > LIMITS.calendarName) errors.push('name-too-long');
  if (!COLOR_RE.test(c.color)) errors.push('invalid-color');
  return errors;
}
