/** Task rules: progress, completion (incl. recurring), grouping for Today / Inbox / Upcoming. */
import { nextOccurrence } from '../recurrence/recurrence';
import type { Task } from '../model/types';
import { addDays, type DayKey } from '../time/days';

export const OPEN_STATUSES = new Set(['todo', 'doing', 'waiting']);

export function isOpen(t: Task): boolean {
  return !t.deletedAt && OPEN_STATUSES.has(t.status);
}

export function isInbox(t: Task): boolean {
  return isOpen(t) && !t.parentId && !t.calendarId && !t.dueDay && !t.startDay;
}

/** Progress 0–100: manual value, else share of done subtasks + checklist items, else 0/100 by status. */
export function taskProgress(t: Task, subtasks: Task[]): number {
  if (t.status === 'done') return 100;
  if (t.progress !== null && t.progress !== undefined) return Math.max(0, Math.min(100, Math.round(t.progress)));
  const items = [
    ...subtasks.filter((s) => !s.deletedAt && s.status !== 'cancelled').map((s) => s.status === 'done'),
    ...t.checklist.map((c) => c.done),
  ];
  if (!items.length) return 0;
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

/**
 * Complete a task. A recurring task records the completion and moves to its next
 * due day (status back to todo); a one-off task becomes done.
 */
export function completeTask(t: Task, now: string, today: DayKey): Task {
  const completions = [...(t.completions ?? []), { at: now, dueDay: t.dueDay }];
  if (t.recurrence && t.dueDay) {
    const next = nextOccurrence(t.dueDay, t.recurrence, t.dueDay < today ? addDays(today, -1) : t.dueDay);
    if (next) {
      const shift = t.startDay ? dayDiff(next, t.dueDay) : 0;
      return {
        ...t,
        completions,
        dueDay: next,
        startDay: t.startDay ? addDays(t.startDay, shift) : null,
        status: 'todo',
        checklist: t.checklist.map((c) => ({ ...c, done: false })),
        completedAt: null,
        updatedAt: now,
      };
    }
  }
  return { ...t, completions, status: 'done', completedAt: now, updatedAt: now };
}

export function reopenTask(t: Task, now: string): Task {
  return { ...t, status: 'todo', completedAt: null, updatedAt: now };
}

function dayDiff(a: DayKey, b: DayKey): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export interface TaskBuckets {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDate: Task[];
  inbox: Task[];
}

/** Group open top-level tasks. "today" = due today, or started and not yet due. */
export function bucketTasks(tasks: Task[], today: DayKey, upcomingDays = 7): TaskBuckets {
  const b: TaskBuckets = { overdue: [], today: [], upcoming: [], noDate: [], inbox: [] };
  const horizon = addDays(today, upcomingDays);
  for (const t of tasks) {
    if (!isOpen(t) || t.parentId) continue;
    if (isInbox(t)) b.inbox.push(t);
    else if (t.dueDay && t.dueDay < today) b.overdue.push(t);
    else if (t.dueDay === today || (t.startDay && t.startDay <= today && (!t.dueDay || t.dueDay >= today))) b.today.push(t);
    else if (t.dueDay && t.dueDay <= horizon) b.upcoming.push(t);
    else if (!t.dueDay) b.noDate.push(t);
  }
  const byDue = (a: Task, c: Task) =>
    (a.dueDay ?? '9999') < (c.dueDay ?? '9999') ? -1 : (a.dueDay ?? '9999') > (c.dueDay ?? '9999') ? 1 : c.priority - a.priority || a.sortOrder - c.sortOrder;
  for (const k of Object.keys(b) as (keyof TaskBuckets)[]) b[k].sort(byDue);
  return b;
}
