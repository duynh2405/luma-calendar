/** Task details: edits save immediately (each change is undoable). */
import { CalendarPlus, Check, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { uuidv7 } from '@/core/model/id';
import type { Priority, Task, TaskStatus } from '@/core/model/types';
import { taskProgress } from '@/core/tasks/tasks';
import { instantToWall, todayKey, wallToInstant } from '@/core/time/zone';
import { activeCalendars, useData } from '@/data/store';
import { formatShortDate, useLocale, useT } from '@/i18n';
import type { StringKey } from '@/i18n/strings';
import { DateInput, TimeInput } from '@/ui/DateTimeInputs';
import { CalendarIcon } from '@/ui/icons';
import { Button, Field, IconButton, Segmented, Txt } from '@/ui/primitives';
import { radius, space, useTheme, withAlpha } from '@/ui/theme';

import { safely } from '../calendar/actions';
import { RecurrencePicker } from '../calendar/RecurrencePicker';
import { eventTimeLabel } from '../calendar/shared';
import { useUi } from '../calendar/ui-store';

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

export function TaskPanel() {
  const panel = useUi((s) => s.taskPanel);
  const task = useData((s) => (panel ? s.tasks[panel.id] : undefined));
  if (!panel || !task) return null;
  return <TaskForm key={panel.key} task={task} />;
}

function TaskForm({ task }: { task: Task }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const calendars = useData((s) => s.calendars);
  const allTasks = useData((s) => s.tasks);
  const events = useData((s) => s.events);
  const tz = useData((s) => s.settings.timeZone);
  const fmt = useData((s) => s.settings.timeFormat);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [newItem, setNewItem] = useState('');
  const [newSub, setNewSub] = useState('');
  const today = todayKey(tz);
  const [blockDay, setBlockDay] = useState(task.dueDay && task.dueDay >= today ? task.dueDay : today);
  const [blockMin, setBlockMin] = useState(9 * 60);
  const [blockDur, setBlockDur] = useState(task.estimateMin ?? 60);

  const close = () => useUi.getState().openTask(null);
  const update = (patch: Partial<Task>) => safely(() => useData.getState().updateTask(task.id, patch));
  const subtasks = Object.values(allTasks)
    .filter((x) => x.parentId === task.id && !x.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const blocks = Object.values(events)
    .filter((e) => e.taskId === task.id && !e.deletedAt)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const parent = task.parentId ? allTasks[task.parentId] : undefined;
  const linkedEvent = task.linkedEventId ? events[task.linkedEventId] : undefined;
  const progress = taskProgress(task, subtasks);
  const done = task.status === 'done';

  const commitTitle = () => {
    if (title.trim() && title !== task.title) update({ title });
    else setTitle(task.title);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={T('st.done')}
          onPress={() => safely(() => useData.getState().toggleTaskDone(task.id), done ? 'task-reopened' : 'task-completed')}
          style={[styles.bigCheck, { borderColor: t.accent, backgroundColor: done ? t.accent : 'transparent' }]}
        >
          {done ? <Check size={14} color={t.accentText} strokeWidth={3} /> : null}
        </Pressable>
        <Txt size="lg" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
          {parent ? `${parent.title} › ` : ''}
          {T('taskLabel')}
        </Txt>
        <IconButton
          icon={Trash2}
          title={T('delete')}
          onPress={() => {
            safely(() => useData.getState().deleteTask(task.id), 'task-deleted');
            close();
          }}
        />
        <IconButton icon={X} title={T('close')} onPress={close} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Field large value={title} onChangeText={setTitle} onBlur={commitTitle} onSubmitEditing={commitTitle} placeholder={T('taskTitlePlaceholder')} maxLength={200} />

        <Section label={T('category')}>
          <View style={styles.chips}>
            <Chip label={T('noCategory')} selected={!task.calendarId} onPress={() => update({ calendarId: null })} />
            {activeCalendars(calendars).map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                icon={<CalendarIcon name={c.icon} size={14} color={c.color} />}
                selected={task.calendarId === c.id}
                onPress={() => update({ calendarId: c.id })}
              />
            ))}
          </View>
        </Section>

        <Section label={T('status')}>
          <Segmented
            size="sm"
            value={task.status}
            onChange={(status: TaskStatus) =>
              status === 'done' ? safely(() => useData.getState().toggleTaskDone(task.id), 'task-completed') : update({ status, completedAt: null })
            }
            options={(['todo', 'doing', 'waiting', 'done', 'cancelled'] as TaskStatus[]).map((s) => ({ value: s, label: T(`st.${s}` as StringKey) }))}
          />
        </Section>

        <Section label={T('priority')}>
          <Segmented
            size="sm"
            value={task.priority}
            onChange={(priority: Priority) => update({ priority })}
            options={([0, 1, 2, 3] as Priority[]).map((p) => ({ value: p, label: T(`p${p}` as StringKey) }))}
          />
        </Section>

        <View style={styles.dateGrid}>
          <DateRow
            label={T('startDate')}
            value={task.startDay}
            onChange={(startDay) => update({ startDay, dueDay: task.dueDay && startDay && task.dueDay < startDay ? startDay : task.dueDay })}
            fallback={today}
          />
          <DateRow label={T('dueDate')} value={task.dueDay} onChange={(dueDay) => update({ dueDay, recurrence: dueDay ? task.recurrence : null })} fallback={today} />
          {task.dueDay ? (
            <View style={styles.row}>
              <Txt size="sm" color="textMuted" style={styles.label}>
                {T('dueTime')}
              </Txt>
              {task.dueMin !== null ? (
                <>
                  <TimeInput label={T('dueTime')} value={toHHMM(task.dueMin)} onChange={(v) => update({ dueMin: fromHHMM(v) })} />
                  <Button size="sm" variant="ghost" label={T('clearDate')} onPress={() => update({ dueMin: null })} />
                </>
              ) : (
                <Button size="sm" label="+" onPress={() => update({ dueMin: 17 * 60 })} />
              )}
            </View>
          ) : null}
          <View style={styles.row}>
            <Txt size="sm" color="textMuted" style={styles.label}>
              {T('estimate')}
            </Txt>
            <Segmented
              size="sm"
              value={task.estimateMin ?? 0}
              onChange={(m: number) => update({ estimateMin: m || null })}
              options={[0, 30, 60, 120, 240, 480].map((m) => ({ value: m, label: m ? (m < 60 ? `${m}p` : `${m / 60}h`) : '–' }))}
            />
          </View>
        </View>

        {task.dueDay ? (
          <Section label={T('repeat')}>
            <RecurrencePicker value={task.recurrence} start={task.dueDay} onChange={(recurrence) => update({ recurrence })} />
          </Section>
        ) : null}

        <Section label={`${T('progress')} · ${progress}%`}>
          <View style={[styles.progressTrack, { backgroundColor: t.surfaceAlt }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: t.accent }]} />
          </View>
          <Segmented
            size="sm"
            value={task.progress ?? -1}
            onChange={(v: number) => update({ progress: v < 0 ? null : v })}
            options={[-1, 0, 25, 50, 75, 100].map((v) => ({ value: v, label: v < 0 ? T('progressAuto') : `${v}%` }))}
          />
        </Section>

        <Section label={T('checklist')}>
          {task.checklist.map((item) => (
            <View key={item.id} style={styles.row}>
              <SmallCheck
                checked={item.done}
                onPress={() => update({ checklist: task.checklist.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)) })}
              />
              <Txt style={[{ flex: 1 }, item.done && styles.strike]} color={item.done ? 'textFaint' : 'text'}>
                {item.text}
              </Txt>
              <IconButton icon={X} size="sm" title={T('delete')} onPress={() => update({ checklist: task.checklist.filter((c) => c.id !== item.id) })} />
            </View>
          ))}
          <Field
            placeholder={T('addItem')}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={() => {
              if (!newItem.trim()) return;
              update({ checklist: [...task.checklist, { id: uuidv7(), text: newItem.trim(), done: false }] });
              setNewItem('');
            }}
            blurOnSubmit={false}
          />
        </Section>

        {!task.parentId ? (
          <Section label={T('subtasks')}>
            {subtasks.map((s) => (
              <View key={s.id} style={styles.row}>
                <SmallCheck checked={s.status === 'done'} onPress={() => safely(() => useData.getState().toggleTaskDone(s.id))} />
                <Pressable style={{ flex: 1 }} onPress={() => useUi.getState().openTask(s.id)}>
                  <Txt style={s.status === 'done' && styles.strike} color={s.status === 'done' ? 'textFaint' : 'text'} numberOfLines={1}>
                    {s.title}
                  </Txt>
                </Pressable>
                {s.dueDay ? (
                  <Txt size="xs" color="textMuted">
                    {formatShortDate(locale, s.dueDay)}
                  </Txt>
                ) : null}
              </View>
            ))}
            <Field
              placeholder={T('addSubtask')}
              value={newSub}
              onChangeText={setNewSub}
              onSubmitEditing={() => {
                if (!newSub.trim()) return;
                safely(() => useData.getState().createTask({ title: newSub, parentId: task.id, calendarId: task.calendarId }));
                setNewSub('');
              }}
              blurOnSubmit={false}
            />
          </Section>
        ) : null}

        <Section label={T('schedule')}>
          <Txt size="xs" color="textMuted">
            {T('scheduleHint')}
          </Txt>
          {blocks.map((e) => (
            <Pressable key={e.id} onPress={() => useUi.getState().openEditor({ mode: 'edit', id: e.id })} style={[styles.block, { borderColor: t.border }]}>
              <CalendarPlus size={14} color={t.textMuted} strokeWidth={1.75} />
              <Txt size="sm">
                {formatShortDate(locale, e.allDay ? e.start : instantToWall(e.start, tz).day)} · {eventTimeLabel(e, tz, fmt)}
              </Txt>
            </Pressable>
          ))}
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <DateInput label={T('day')} value={blockDay} onChange={setBlockDay} />
            <TimeInput label={T('start')} value={toHHMM(blockMin)} onChange={(v) => setBlockMin(fromHHMM(v))} />
            <Segmented
              size="sm"
              value={blockDur}
              onChange={setBlockDur}
              options={[30, 60, 90, 120, 180, 240].map((m) => ({ value: m, label: m < 60 ? `${m}p` : `${m / 60}h` }))}
            />
            <Button
              size="sm"
              variant="primary"
              icon={CalendarPlus}
              label={T('schedule')}
              onPress={() => {
                const start = wallToInstant(blockDay, blockMin, tz);
                const end = new Date(Date.parse(start) + blockDur * 60000).toISOString();
                safely(() => useData.getState().scheduleTask(task.id, start, end, tz), 'task-scheduled');
              }}
            />
          </View>
        </Section>

        {linkedEvent ? (
          <Section label={task.linkRole === 'post' ? T('linkPost') : T('linkPrep')}>
            <Pressable onPress={() => useUi.getState().openEditor({ mode: 'edit', id: linkedEvent.id })} style={[styles.block, { borderColor: t.border }]}>
              <Txt size="sm">{linkedEvent.title}</Txt>
            </Pressable>
          </Section>
        ) : null}

        <Section label={T('notes')}>
          <Field multiline value={notes} onChangeText={setNotes} onBlur={() => notes !== task.notes && update({ notes })} maxLength={10000} />
        </Section>

        {task.completions?.length ? (
          <Section label={T('completionHistory')}>
            {[...task.completions].reverse().slice(0, 10).map((c, i) => (
              <Txt key={i} size="sm" color="textMuted">
                {formatShortDate(locale, instantToWall(c.at, tz).day)}
                {c.dueDay ? ` · ${T('dueDate').toLowerCase()} ${formatShortDate(locale, c.dueDay)}` : ''}
              </Txt>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt size="sm" color="textMuted" weight="medium">
        {label}
      </Txt>
      {children}
    </View>
  );
}

function DateRow({ label, value, onChange, fallback }: { label: string; value: string | null; onChange: (v: string | null) => void; fallback: string }) {
  const T = useT();
  return (
    <View style={styles.row}>
      <Txt size="sm" color="textMuted" style={styles.label}>
        {label}
      </Txt>
      {value ? (
        <>
          <DateInput label={label} value={value} onChange={onChange} />
          <Button size="sm" variant="ghost" label={T('clearDate')} onPress={() => onChange(null)} />
        </>
      ) : (
        <Button size="sm" icon={Plus} label={T('setDate')} onPress={() => onChange(fallback)} />
      )}
    </View>
  );
}

function Chip({ label, selected, onPress, color, icon }: { label: string; selected: boolean; onPress: () => void; color?: string; icon?: React.ReactNode }) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? c : t.border, backgroundColor: selected ? withAlpha(c, 0.14) : t.bg }]}
    >
      {icon}
      <Txt size="sm" weight={selected ? 'semibold' : 'regular'}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function SmallCheck({ checked, onPress, color }: { checked: boolean; onPress: () => void; color?: string }) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.smallCheck, { borderColor: c, backgroundColor: checked ? c : 'transparent' }]}
    >
      {checked ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: space.lg, paddingRight: space.sm, height: 52, borderBottomWidth: 1 },
  bigCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, height: 30 },
  dateGrid: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 80 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  strike: { textDecorationLine: 'line-through' },
  smallCheck: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  block: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, padding: 8 },
});
