import { Check, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import type { EventDraft } from '@/core/model/draft';
import type { CalendarEvent, ID, Task } from '@/core/model/types';
import { expandEvents } from '@/core/recurrence/expand';
import { addDays, type DayKey } from '@/core/time/days';
import { instantToWall, formatMinutes } from '@/core/time/zone';
import { defaultCalendarId, eventColor, taskColor, useData, visibleEvents, visibleTasks } from '@/data/store';
import { radius, useTheme, withAlpha } from '@/ui/theme';
import { Txt } from '@/ui/primitives';

import { type DisplayEvent, requestDelete } from './actions';
import { useUi } from './ui-store';

export const SNAP_MIN = 15;
export const snap = (min: number, step = SNAP_MIN) => Math.round(min / step) * step;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function useCalendarData() {
  const { calendars, events, tasks, settings } = useData(
    useShallow((s) => ({ calendars: s.calendars, events: s.events, tasks: s.tasks, settings: s.settings })),
  );
  const visible = useMemo(() => visibleEvents(calendars, events), [calendars, events]);
  const shownTasks = useMemo(() => visibleTasks(calendars, tasks), [calendars, tasks]);
  return { calendars, events: visible, tasks: shownTasks, settings, tz: settings.timeZone };
}

/** A task shown on its due day as an all-day item. */
export function taskAsDisplay(t: Task, calendars: Record<ID, { color: string }>): DisplayEvent {
  return {
    id: `task:${t.id}`,
    instanceKey: `task:${t.id}`,
    masterId: `task:${t.id}`,
    occurrenceDay: null,
    calendarId: t.calendarId ?? '',
    title: t.title,
    description: '',
    location: '',
    color: taskColor(t, calendars as never),
    allDay: true,
    start: t.dueDay!,
    end: addDays(t.dueDay!, 1),
    timeZone: null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deletedAt: null,
    task: t,
  };
}

/** Event occurrences + tasks with a due date that touch [from, to]. */
export function useDisplayEvents(from: DayKey, to: DayKey): DisplayEvent[] {
  const { calendars, events, tasks, tz } = useCalendarData();
  return useMemo(() => {
    const list: DisplayEvent[] = expandEvents(events, from, to, tz);
    for (const t of tasks) {
      if (t.parentId || !t.dueDay || t.dueDay < from || t.dueDay > to || t.status === 'cancelled') continue;
      list.push(taskAsDisplay(t, calendars));
    }
    return list;
  }, [events, tasks, calendars, from, to, tz]);
}

/** Stable UI key of a displayed item. */
export const keyOf = (e: CalendarEvent) => (e as DisplayEvent).instanceKey ?? e.id;

export function newDraft(day: DayKey, startMin: number, endMin: number, allDay = false, endDay = day): EventDraft | null {
  const calendarId = defaultCalendarId(useData.getState().calendars);
  if (!calendarId) return null;
  const overflow = !allDay && endMin >= 1440;
  return {
    title: '',
    calendarId,
    allDay,
    startDay: day,
    startMin,
    endDay: overflow ? addDays(endDay, Math.floor(endMin / 1440)) : endDay,
    endMin: overflow ? endMin % 1440 : endMin,
    location: '',
    description: '',
    color: null,
  };
}

export function openCreate(draft: EventDraft | null) {
  if (draft) useUi.getState().openEditor({ mode: 'create', draft });
  else useUi.getState().setCalendarDialog({ mode: 'create' });
}

export function eventTimeLabel(e: CalendarEvent, tz: string, fmt: '24h' | '12h'): string {
  if (e.allDay) return '';
  const s = instantToWall(e.start, tz);
  const en = instantToWall(e.end, tz);
  return `${formatMinutes(s.minutes, fmt)} – ${formatMinutes(en.minutes, fmt)}`;
}

/** Web-only props (title tooltip, context menu) that RN types don't declare. */
export function webProps(p: { title?: string; onContextMenu?: (e: unknown) => void }): object {
  return Platform.OS === 'web' ? p : {};
}

/**
 * A job (event or task) as a small button: tinted pill with a colour dot. Hover shows a ✕ that asks
 * to delete it; clicking the pill opens its details.
 */
export function EventBar({
  event,
  compact,
  showTime,
  selected,
  ghost,
  continuesBefore,
  continuesAfter,
  onPointerDown,
  onPress,
}: {
  event: CalendarEvent;
  compact?: boolean;
  showTime?: boolean;
  selected?: boolean;
  ghost?: boolean;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  onPointerDown?: (e: { nativeEvent: unknown; stopPropagation?: () => void }) => void;
  onPress?: () => void;
}) {
  const t = useTheme();
  const { calendars, tz, settings } = useCalendarData();
  const [hover, setHover] = useState(false);
  const color = eventColor(event, calendars);
  const task = (event as DisplayEvent).task;
  const done = task ? task.status === 'done' : !!event.doneAt;
  const time = showTime && !event.allDay ? formatMinutes(instantToWall(event.start, tz).minutes, settings.timeFormat) : '';
  const alpha = Math.min(0.5, t.tintAlpha + 0.04 + (hover || selected ? 0.1 : 0));
  return (
    <Pressable
      onPress={onPress}
      onPointerDown={onPointerDown as never}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityLabel={`${event.title} ${time}`}
      {...webProps({ title: `${time ? time + ' ' : ''}${event.title}` })}
      style={[
        styles.bar,
        {
          backgroundColor: withAlpha(color, alpha),
          opacity: ghost ? 0.55 : done && !task ? 0.6 : 1,
          borderTopLeftRadius: continuesBefore ? 0 : radius.md,
          borderBottomLeftRadius: continuesBefore ? 0 : radius.md,
          borderTopRightRadius: continuesAfter ? 0 : radius.md,
          borderBottomRightRadius: continuesAfter ? 0 : radius.md,
        },
        selected && ({ outlineColor: color, outlineWidth: 1, outlineStyle: 'solid' } as object),
      ]}
    >
      {task ? (
        <Pressable
          onPress={() => useData.getState().toggleTaskDone(task.id)}
          onPointerDown={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          hitSlop={6}
          style={[styles.check, { borderColor: color, backgroundColor: done ? color : 'transparent' }]}
        >
          {done ? <Check size={9} color="#fff" strokeWidth={3} /> : null}
        </Pressable>
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      {time ? (
        <Txt size="xs" color="textMuted" tabular numberOfLines={1}>
          {time}
        </Txt>
      ) : null}
      <Txt
        size="xs"
        weight="medium"
        numberOfLines={1}
        color={done ? 'textFaint' : 'text'}
        style={[{ flexShrink: 1, flexGrow: 1 }, done && { textDecorationLine: 'line-through' }]}
      >
        {event.title}
      </Txt>
      {hover && !ghost ? (
        <Pressable
          onPress={() => requestDelete(event as DisplayEvent)}
          onPointerDown={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          hitSlop={4}
          style={[styles.x, { backgroundColor: t.bg, borderColor: t.borderStrong }]}
        >
          <X size={11} color={t.textMuted} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    overflow: 'hidden',
    cursor: 'pointer',
  } as object,
  x: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  check: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
