import { CalendarClock, Flag, ListChecks, Repeat } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Task } from '@/core/model/types';
import { taskProgress } from '@/core/tasks/tasks';
import { formatMinutes, todayKey } from '@/core/time/zone';
import { taskColor, useData } from '@/data/store';
import { formatShortDate, useLocale, useT } from '@/i18n';
import { HoverPressable, Txt } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

import { safely } from '../calendar/actions';
import { useUi } from '../calendar/ui-store';
import { SmallCheck } from './TaskPanel';

export function TaskRow({ task, showDate = true }: { task: Task; showDate?: boolean }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const calendars = useData((s) => s.calendars);
  const settings = useData((s) => s.settings);
  const tasksMap = useData((s) => s.tasks);
  const subtasks = useMemo(() => Object.values(tasksMap).filter((x) => x.parentId === task.id && !x.deletedAt), [tasksMap, task.id]);
  const hasBlock = useData((s) => Object.values(s.events).some((e) => e.taskId === task.id && !e.deletedAt));
  const selected = useUi((s) => s.taskPanel?.id === task.id);
  const today = todayKey(settings.timeZone);
  const done = task.status === 'done';
  const overdue = !done && task.dueDay !== null && task.dueDay < today;
  const color = taskColor(task, calendars);
  const cal = task.calendarId ? calendars[task.calendarId] : undefined;
  const progressItems = subtasks.length + task.checklist.length;

  return (
    <HoverPressable
      onPress={() => useUi.getState().openTask(task.id)}
      accessibilityRole="button"
      style={({ hovered }) => [styles.row, { borderBottomColor: t.border }, (hovered || selected) && { backgroundColor: selected ? t.accentSoft : t.surfaceHover }]}
    >
      <SmallCheck
        checked={done}
        color={task.priority === 3 ? t.danger : color}
        onPress={() => safely(() => useData.getState().toggleTaskDone(task.id), done ? 'task-reopened' : 'task-completed')}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt numberOfLines={2} color={done ? 'textFaint' : 'text'} style={done && { textDecorationLine: 'line-through' }}>
          {task.title}
        </Txt>
        <View style={styles.meta}>
          {showDate && task.dueDay ? (
            <Txt size="xs" color={overdue ? 'danger' : task.dueDay === today ? 'accent' : 'textMuted'} weight={overdue ? 'semibold' : 'regular'}>
              {task.dueDay === today ? T('today') : formatShortDate(locale, task.dueDay)}
              {task.dueMin !== null ? ` ${formatMinutes(task.dueMin, settings.timeFormat)}` : ''}
            </Txt>
          ) : null}
          {task.recurrence ? <Repeat size={12} color={t.textMuted} strokeWidth={1.75} /> : null}
          {hasBlock ? <CalendarClock size={12} color={t.textMuted} strokeWidth={1.75} /> : null}
          {progressItems ? (
            <View style={styles.metaItem}>
              <ListChecks size={12} color={t.textMuted} strokeWidth={1.75} />
              <Txt size="xs" color="textMuted">
                {taskProgress(task, subtasks)}%
              </Txt>
            </View>
          ) : null}
          {task.priority >= 2 ? <Flag size={12} color={task.priority === 3 ? t.danger : t.warning} strokeWidth={2} /> : null}
          {cal ? (
            <View style={styles.metaItem}>
              <View style={[styles.dot, { backgroundColor: cal.color }]} />
              <Txt size="xs" color="textMuted" numberOfLines={1}>
                {cal.name}
              </Txt>
            </View>
          ) : null}
          {task.status === 'doing' || task.status === 'waiting' ? (
            <Txt size="xs" color="textMuted">
              · {T(`st.${task.status}`)}
            </Txt>
          ) : null}
        </View>
      </View>
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
