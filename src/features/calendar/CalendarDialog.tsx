import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CALENDAR_COLORS, useData } from '@/data/store';
import { useT } from '@/i18n';
import { CALENDAR_ICONS } from '@/ui/icons';
import { Button, Dialog, Field, Txt } from '@/ui/primitives';
import { radius, useTheme, withAlpha } from '@/ui/theme';

import { safely } from './actions';
import { useUi } from './ui-store';

export function CalendarDialog() {
  const dialog = useUi((s) => s.calendarDialog);
  if (!dialog) return null;
  // Remount per dialog session so the form starts from fresh state.
  return <CalendarForm key={dialog.mode === 'edit' ? dialog.id : 'new'} editId={dialog.mode === 'edit' ? dialog.id : null} />;
}

function CalendarForm({ editId }: { editId: string | null }) {
  const t = useTheme();
  const T = useT();
  const close = () => useUi.getState().setCalendarDialog(null);
  const existing = useData((s) => (editId ? s.calendars[editId] : undefined));
  const count = useData((s) => Object.values(s.calendars).filter((c) => !c.deletedAt).length);

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState<string>(existing?.color ?? CALENDAR_COLORS[count % CALENDAR_COLORS.length]);
  const [icon, setIcon] = useState(existing?.icon ?? 'calendar');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    if (!name.trim()) {
      setError(T('err.name-required'));
      return;
    }
    const ok = safely(() => {
      if (existing) useData.getState().updateCalendar(existing.id, { name, color, icon });
      else useData.getState().createCalendar({ name, color, icon });
      return true;
    }, existing ? 'calendar-updated' : 'calendar-created');
    if (ok) close();
  }

  const d = useData.getState();
  return (
    <Dialog
      visible
      onClose={close}
      title={existing ? T('editCalendar') : T('newCalendar')}
      footer={
        <>
          {existing ? (
            <Button
              label={confirmDelete ? T('deleteCalendar') + '?' : T('delete')}
              variant="danger"
              style={{ marginRight: 'auto' }}
              onPress={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                safely(() => d.deleteCalendar(existing.id), 'calendar-deleted');
                close();
              }}
            />
          ) : null}
          <Button label={T('cancel')} onPress={close} />
          <Button label={T('save')} variant="primary" onPress={save} />
        </>
      }
    >
      <Field
        label={T('name')}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        onSubmitEditing={save}
        autoFocus
        maxLength={60}
        error={error}
      />
      {confirmDelete ? (
        <Txt size="sm" color="danger">
          {T('deleteCalendarConfirm')}
        </Txt>
      ) : null}
      <View style={{ gap: 6 }}>
        <Txt size="sm" color="textMuted" weight="medium">
          {T('color')}
        </Txt>
        <View style={styles.wrap}>
          {CALENDAR_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityLabel={c}
              accessibilityState={{ selected: c === color }}
              style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? t.text : 'transparent' }]}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Txt size="sm" color="textMuted" weight="medium">
          {T('icon')}
        </Txt>
        <View style={styles.wrap}>
          {Object.entries(CALENDAR_ICONS).map(([key, Icon]) => (
            <Pressable
              key={key}
              onPress={() => setIcon(key)}
              accessibilityRole="radio"
              accessibilityLabel={key}
              accessibilityState={{ selected: key === icon }}
              style={[
                styles.iconBox,
                { borderColor: key === icon ? color : t.border, backgroundColor: key === icon ? withAlpha(color, 0.14) : t.bg },
              ]}
            >
              <Icon size={18} color={key === icon ? color : t.textMuted} strokeWidth={1.75} />
            </Pressable>
          ))}
        </View>
      </View>
      {existing ? (
        <View style={styles.wrap}>
          {!existing.isDefault ? (
            <Button size="sm" label={T('setDefault')} onPress={() => d.setDefaultCalendar(existing.id)} />
          ) : (
            <Txt size="sm" color="textMuted">
              {T('isDefault')}
            </Txt>
          )}
          <Button size="sm" label={T('moveUp')} onPress={() => d.moveCalendar(existing.id, -1)} />
          <Button size="sm" label={T('moveDown')} onPress={() => d.moveCalendar(existing.id, 1)} />
          <Button
            size="sm"
            label={existing.archivedAt ? T('unarchive') : T('archive')}
            onPress={() => {
              safely(() => d.setArchived(existing.id, !existing.archivedAt), existing.archivedAt ? 'calendar-unarchived' : 'calendar-archived');
              close();
            }}
          />
        </View>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  iconBox: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
