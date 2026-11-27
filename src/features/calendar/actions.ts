/** UI-level actions that combine data mutations with feedback (toast + undo). */
import type { CalendarEvent, Task } from '@/core/model/types';
import type { EditScope, EventContent } from '@/core/recurrence/edit';
import type { EventInstance } from '@/core/recurrence/expand';
import { addDays, diffDays } from '@/core/time/days';
import { instantToWall } from '@/core/time/zone';
import { useData } from '@/data/store';
import { translate } from '@/i18n';
import type { StringKey } from '@/i18n/strings';

import { useUi } from './ui-store';

/** An instance shown in a calendar view: an event occurrence, or a task on its due day. */
export type DisplayEvent = EventInstance & { task?: Task };

function label(key: string): string {
  const locale = useData.getState().settings.locale;
  return translate(locale, `undo.${key}` as StringKey);
}

/** Show an undo toast for the latest committed change. */
export function notifyChange(undoKey: string) {
  useUi.getState().showToast(label(undoKey), true);
}

export function performUndo() {
  const undone = useData.getState().undo();
  const locale = useData.getState().settings.locale;
  if (undone) useUi.getState().showToast(translate(locale, 'undone', { label: label(undone) }), false);
}

/** Run a data mutation; report validation/storage errors as a toast instead of crashing. */
export function safely<T>(fn: () => T, undoKey?: string): T | undefined {
  try {
    const r = fn();
    if (undoKey) notifyChange(undoKey);
    return r;
  } catch (err) {
    const locale = useData.getState().settings.locale;
    const code = err instanceof Error ? err.message.split(',')[0] : '';
    const msg = translate(locale, `err.${code}` as StringKey);
    useUi.getState().showToast(msg.startsWith('err.') ? String(err) : msg, false);
    return undefined;
  }
}

/** A generated occurrence of a series (not the master record itself, not an override). */
export function isGeneratedOccurrence(i: EventInstance): boolean {
  return i.instanceKey !== i.id;
}

/** Content fields of an event (what an occurrence edit carries). */
export function contentOf(e: CalendarEvent): EventContent {
  const {
    id: _i,
    createdAt: _c,
    updatedAt: _u,
    deletedAt: _d,
    recurrence: _r,
    exdates: _x,
    recurrenceMasterId: _m,
    recurrenceDay: _y,
    ...rest
  } = e;
  return rest as EventContent;
}

/** Open whatever an instance represents (event editor or task panel). */
export function openInstance(i: DisplayEvent) {
  if (i.task) useUi.getState().openTask(i.task.id);
  else useUi.getState().openEditor({ mode: 'edit', id: i.id, instance: i });
}

/**
 * Apply a time change (move / resize) to an instance. Tasks move their due day;
 * occurrences of a series ask "this / following / all"; other events update directly.
 */
export function changeInstanceTime(i: DisplayEvent, patch: Pick<CalendarEvent, 'start' | 'end'>, undoKey: string) {
  if (i.task) {
    const days = diffDays(String(patch.start).slice(0, 10), String(i.start).slice(0, 10));
    const t = i.task;
    if (!days || !t.dueDay) return;
    safely(
      () =>
        useData.getState().updateTask(t.id, {
          dueDay: addDays(t.dueDay!, days),
          startDay: t.startDay ? addDays(t.startDay, days) : null,
        }, 'task-moved'),
      'task-moved',
    );
    return;
  }
  const content = { ...contentOf(i), ...patch } as EventContent;
  if (isGeneratedOccurrence(i)) {
    useUi.getState().setScopePrompt({ kind: 'edit', instance: i, content, label: undoKey });
    return;
  }
  safely(() => useData.getState().updateEvent(i.id, patch, undoKey), undoKey);
}

/**
 * Mark an event (or one occurrence of a series) done / not done. Never asks for a scope:
 * "done" always applies to this occurrence only. Tasks use their own status.
 */
export function toggleInstanceDone(i: DisplayEvent) {
  if (i.task) {
    const wasDone = i.task.status === 'done';
    safely(() => useData.getState().toggleTaskDone(i.task!.id), wasDone ? 'task-reopened' : 'task-completed');
    return;
  }
  const doneAt = i.doneAt ? null : new Date().toISOString();
  const key = doneAt ? 'event-done' : 'event-undone';
  if (isGeneratedOccurrence(i)) {
    const content = { ...contentOf(i), doneAt } as EventContent;
    safely(() => useData.getState().updateOccurrence({ masterId: i.masterId, occurrenceDay: i.occurrenceDay }, 'this', content, key), key);
    return;
  }
  safely(() => useData.getState().updateEvent(i.id, { doneAt }, key), key);
}

/** Delete an instance (asks the scope for occurrences of a series). */
export function deleteInstance(i: DisplayEvent, onDone?: () => void) {
  if (i.task) {
    safely(() => useData.getState().deleteTask(i.task!.id), 'task-deleted');
    onDone?.();
    return;
  }
  if (isGeneratedOccurrence(i)) {
    useUi.getState().setScopePrompt({ kind: 'delete', instance: i, onDone });
    return;
  }
  const master = useData.getState().events[i.id];
  if (master?.recurrence) {
    // Opening the series itself (e.g. from search): treat as an occurrence on its first day.
    const day = master.allDay ? master.start : instantToWall(master.start, master.timeZone).day;
    useUi.getState().setScopePrompt({ kind: 'delete', instance: { ...i, instanceKey: `${i.id}@${day}`, occurrenceDay: day }, onDone });
    return;
  }
  safely(() => useData.getState().deleteEvent(i.id), 'event-deleted');
  onDone?.();
}

/** Resolve a pending scope prompt. */
export function applyScope(scope: EditScope) {
  const p = useUi.getState().scopePrompt;
  if (!p) return;
  useUi.getState().setScopePrompt(null);
  const ref = { masterId: p.instance.masterId, occurrenceDay: p.instance.occurrenceDay };
  if (p.kind === 'edit') {
    const ok = safely(() => {
      useData.getState().updateOccurrence(ref, scope, p.content, p.label);
      return true;
    }, p.label);
    if (ok) p.onDone?.();
  } else {
    safely(() => useData.getState().deleteOccurrence(ref, scope), 'event-deleted');
    p.onDone?.();
  }
}
