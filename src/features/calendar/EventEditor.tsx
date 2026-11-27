/** Create / edit an event. Rendered in the side panel (desktop) or a full-screen sheet (mobile). */
import { Check, CheckSquare, Copy, MapPin, Repeat, Trash2, TriangleAlert, X } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { dayInfo } from '@/core/lunar/dayinfo';
import { findConflicts } from '@/core/layout/layout';
import { addWallMinutes, draftFromEvent, type EventDraft, eventFieldsFromDraft } from '@/core/model/draft';
import { type ValidationError, validateEvent } from '@/core/model/validate';
import type { CalendarEvent } from '@/core/model/types';
import { asInstance, expandEvents } from '@/core/recurrence/expand';
import { diffDays } from '@/core/time/days';
import { activeCalendars, CALENDAR_COLORS, useData } from '@/data/store';
import { canChiLine, lunarFullLabel, useLocale, useT } from '@/i18n';
import type { StringKey } from '@/i18n/strings';
import { DateInput, TimeInput } from '@/ui/DateTimeInputs';
import { CalendarIcon } from '@/ui/icons';
import { Button, Field, IconButton, Toggle, Txt } from '@/ui/primitives';
import { radius, space, useTheme, withAlpha } from '@/ui/theme';

import { contentOf, isGeneratedOccurrence, requestDelete, safely, toggleInstanceDone } from './actions';
import { VersionHistory } from './VersionHistory';
import { describeRecurrence, RecurrencePicker } from './RecurrencePicker';
import { eventTimeLabel, useCalendarData } from './shared';
import { type EditorState, useUi } from './ui-store';

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

export function EventEditor() {
  const editor = useUi((s) => s.editor);
  const exists = useData((s) => (editor?.mode === 'edit' ? !!s.events[editor.id] : true));
  if (!editor || !exists) return null;
  // A new key (new editor session) remounts the form with fresh state.
  return <EventEditorForm key={editor.key} editor={editor} />;
}

function EventEditorForm({ editor }: { editor: NonNullable<EditorState> }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const close = useUi((s) => s.closeEditor);
  const { calendars, events, settings, tz } = useCalendarData();
  const existing = useData((s) => (editor.mode === 'edit' ? s.events[editor.id] : undefined));
  const linkedTask = useData((s) => (existing?.taskId ? s.tasks[existing.taskId] : undefined));
  /** The opened occurrence of a series (null for single events, series masters and new events). */
  const occurrence = editor.mode === 'edit' && editor.instance && isGeneratedOccurrence(editor.instance) ? editor.instance : null;

  const [draft, setDraft] = useState<EventDraft>(() =>
    editor.mode === 'create' ? editor.draft : draftFromEvent(occurrence ?? existing!, tz),
  );
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [dirty, setDirty] = useState(false);
  const [syncedAt, setSyncedAt] = useState(existing?.updatedAt);
  const titleRef = useRef<ComponentRef<typeof TextInput>>(null);

  // If the event changes elsewhere (e.g. dragged in the grid) and the form is untouched, reload it,
  // so saving never overwrites a newer change with stale values.
  if (existing && !occurrence && existing.updatedAt !== syncedAt && !dirty) {
    setSyncedAt(existing.updatedAt);
    setDraft(draftFromEvent(existing, tz));
  }

  useEffect(() => {
    if (editor.mode !== 'create') return;
    const id = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [editor.mode]);

  // Keep the placeholder in the grid in sync with the form while creating.
  useEffect(() => {
    if (editor.mode === 'create') useUi.getState().setDraftPreview(draft);
  }, [draft, editor.mode]);

  const cals = activeCalendars(calendars);
  const fields = eventFieldsFromDraft(draft, tz);
  const selfKey = occurrence?.instanceKey ?? existing?.id;
  const conflicts = fields.allDay
    ? []
    : findConflicts(
        expandEvents(events, draft.startDay, draft.endDay, tz).map((i) => ({ ...i, id: i.instanceKey })),
        fields.start,
        fields.end,
        selfKey,
      ).slice(0, 3);

  const update = (patch: Partial<EventDraft>) => {
    setDirty(true);
    setDraft((d) => ({ ...d, ...patch }));
  };

  /** Changing the start keeps the duration (end moves with it). */
  function setStart(day: string, min: number) {
    const duration = diffDays(draft.endDay, draft.startDay) * 1440 + (draft.endMin - draft.startMin);
    if (draft.allDay) {
      const span = diffDays(draft.endDay, draft.startDay);
      update({ startDay: day, endDay: addWallMinutes(day, 0, span * 1440).day });
    } else {
      const end = addWallMinutes(day, min, Math.max(duration, 15));
      update({ startDay: day, startMin: min, endDay: end.day, endMin: end.minutes });
    }
  }

  function save() {
    const f = eventFieldsFromDraft(draft, tz);
    const probe = { ...f, id: 'probe', createdAt: '', updatedAt: '', deletedAt: null } as CalendarEvent;
    const errs = validateEvent(probe);
    setErrors(errs);
    if (errs.length) return;
    if (editor?.mode === 'create') {
      if (safely(() => useData.getState().createEvent(f), 'event-created') !== undefined) close();
    } else if (existing && occurrence) {
      useUi.getState().setScopePrompt({
        kind: 'edit',
        instance: occurrence,
        content: contentOf({ ...existing, ...f, doneAt: occurrence.doneAt ?? null } as CalendarEvent),
        label: 'event-updated',
        onDone: close,
      });
    } else if (existing) {
      const ok = safely(() => {
        useData.getState().updateEvent(existing.id, f);
        return true;
      }, 'event-updated');
      if (ok) close();
    }
  }

  function remove() {
    if (!existing) return;
    requestDelete(occurrence ?? asInstance(existing), close);
  }

  function duplicate() {
    if (!existing) return;
    // An occurrence is copied as a single event at that date.
    const id = occurrence
      ? safely(() => useData.getState().createEvent({ ...contentOf(occurrence), recurrence: null }), 'event-duplicated')
      : safely(() => useData.getState().duplicateEvent(existing.id), 'event-duplicated');
    if (id) useUi.getState().openEditor({ mode: 'edit', id });
  }

  const isDone = !!(occurrence ? occurrence.doneAt : existing?.doneAt);
  const info = dayInfo(draft.startDay);
  const errorText = (e: ValidationError) => T(`err.${e}` as StringKey);
  const titleError = errors.find((e) => e.startsWith('title'));
  const timeError = errors.find((e) => e === 'end-before-start' || e === 'invalid-date');

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Txt size="lg" weight="semibold" style={{ flex: 1 }}>
          {editor.mode === 'create' ? T('newEvent') : T('editEvent')}
        </Txt>
        {existing ? (
          <Button
            size="sm"
            icon={Check}
            variant={isDone ? 'secondary' : 'primary'}
            label={isDone ? T('markUndone') : T('markDone')}
            onPress={() => {
              toggleInstanceDone(occurrence ?? asInstance(existing));
              close();
            }}
          />
        ) : null}
        {existing ? <IconButton icon={Copy} title={T('duplicate')} onPress={duplicate} /> : null}
        {existing ? <IconButton icon={Trash2} title={T('delete')} onPress={remove} /> : null}
        <IconButton icon={X} title={T('close')} onPress={close} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <Field
          ref={titleRef}
          large
          placeholder={T('titlePlaceholder')}
          value={draft.title}
          onChangeText={(title) => update({ title })}
          onSubmitEditing={save}
          returnKeyType="done"
          error={titleError ? errorText(titleError) : null}
          maxLength={200}
        />

        <View style={{ gap: space.sm }}>
          <Toggle label={T('allDay')} value={draft.allDay} onChange={(allDay) => update({ allDay })} />
          <View style={styles.timeRow}>
            <Txt size="sm" color="textMuted" style={styles.timeLabel}>
              {T('start')}
            </Txt>
            <DateInput label={T('start')} value={draft.startDay} onChange={(d) => setStart(d, draft.startMin)} />
            {!draft.allDay ? (
              <TimeInput label={T('start')} value={toHHMM(draft.startMin)} onChange={(v) => setStart(draft.startDay, fromHHMM(v))} />
            ) : null}
          </View>
          <View style={styles.timeRow}>
            <Txt size="sm" color="textMuted" style={styles.timeLabel}>
              {T('end')}
            </Txt>
            <DateInput label={T('end')} value={draft.endDay} onChange={(endDay) => update({ endDay })} />
            {!draft.allDay ? (
              <TimeInput label={T('end')} value={toHHMM(draft.endMin)} onChange={(v) => update({ endMin: fromHHMM(v) })} />
            ) : null}
          </View>
          {timeError ? (
            <Txt size="sm" color="danger">
              {errorText(timeError)}
            </Txt>
          ) : null}
          {settings.showLunar ? (
            <Txt size="sm" color="textMuted">
              {T('lunarPrefix')}: {lunarFullLabel(T, info.lunar)} · {canChiLine(T, draft.startDay, info.lunar).split(', ')[0]}
            </Txt>
          ) : null}
        </View>

        {occurrence && existing?.recurrence ? (
          <View style={[styles.seriesRow, { borderColor: t.border }]}>
            <Repeat size={16} color={t.textMuted} strokeWidth={1.75} />
            <Txt size="sm" style={{ flex: 1 }}>
              {T('partOfSeries', {
                rule: describeRecurrence(T, locale, existing.recurrence, existing.allDay ? existing.start : draftFromEvent(existing, existing.timeZone ?? tz).startDay),
              })}
            </Txt>
            <Button size="sm" label={T('editSeries')} onPress={() => useUi.getState().openEditor({ mode: 'edit', id: existing.id })} />
          </View>
        ) : (
          <RecurrencePicker value={draft.recurrence ?? null} start={draft.startDay} onChange={(recurrence) => update({ recurrence })} />
        )}

        {linkedTask ? (
          <View style={[styles.seriesRow, { borderColor: t.border }]}>
            <CheckSquare size={16} color={t.textMuted} strokeWidth={1.75} />
            <Txt size="sm" style={{ flex: 1 }} numberOfLines={1}>
              {T('linkedTask')}: {linkedTask.title}
            </Txt>
            <Button size="sm" label={T('openTask')} onPress={() => useUi.getState().openTask(linkedTask.id)} />
          </View>
        ) : null}

        {conflicts.length ? (
          <View style={[styles.warning, { backgroundColor: t.warningSoft }]}>
            <TriangleAlert size={16} color={t.warning} strokeWidth={1.75} />
            <View style={{ flex: 1 }}>
              <Txt size="sm" weight="medium" color="warning">
                {T('conflictWith')}:
              </Txt>
              {conflicts.map((c) => (
                <Txt key={c.id} size="sm" color="warning" numberOfLines={1}>
                  {eventTimeLabel(c, tz, settings.timeFormat)} · {c.title}
                </Txt>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 6 }}>
          <Txt size="sm" color="textMuted" weight="medium">
            {T('calendar')}
          </Txt>
          <View style={styles.chips}>
            {cals.map((c) => {
              const active = c.id === draft.calendarId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => update({ calendarId: c.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.chip,
                    { borderColor: active ? c.color : t.border, backgroundColor: active ? withAlpha(c.color, 0.14) : t.bg },
                  ]}
                >
                  <CalendarIcon name={c.icon} size={14} color={c.color} />
                  <Txt size="sm" weight={active ? 'semibold' : 'regular'}>
                    {c.name}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Txt size="sm" color="textMuted" weight="medium">
            {T('color')}
          </Txt>
          <View style={styles.chips}>
            <Pressable
              onPress={() => update({ color: null })}
              style={[styles.chip, { borderColor: draft.color === null ? t.accent : t.border }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.color === null }}
            >
              <Txt size="sm">{T('useCalendarColor')}</Txt>
            </Pressable>
            {CALENDAR_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => update({ color: c })}
                accessibilityRole="radio"
                accessibilityLabel={c}
                accessibilityState={{ selected: draft.color === c }}
                style={[styles.swatch, { backgroundColor: c, borderColor: draft.color === c ? t.text : 'transparent' }]}
              />
            ))}
          </View>
        </View>

        <View style={styles.iconField}>
          <MapPin size={16} color={t.textMuted} strokeWidth={1.75} style={{ marginTop: 10 }} />
          <View style={{ flex: 1 }}>
            <Field placeholder={T('location')} value={draft.location} onChangeText={(location) => update({ location })} maxLength={300} />
          </View>
        </View>
        <Field
          placeholder={T('description')}
          value={draft.description}
          onChangeText={(description) => update({ description })}
          multiline
          maxLength={10000}
        />
        {existing && !occurrence ? <VersionHistory event={existing} /> : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Button label={T('cancel')} onPress={close} />
        <Button label={T('save')} variant="primary" onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    height: 52,
    borderBottomWidth: 1,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  timeLabel: { width: 64 },
  warning: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: radius.md },
  seriesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, padding: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    height: 30,
  },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  iconField: { flexDirection: 'row', gap: 8 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: 1 },
});
