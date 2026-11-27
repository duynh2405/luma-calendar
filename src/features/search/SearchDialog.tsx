/** Global search across events and tasks (accent-insensitive). Ctrl+K or "/". */
import { router } from 'expo-router';
import { CalendarDays, CheckSquare, Repeat } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { asInstance } from '@/core/recurrence/expand';
import { matchesQuery } from '@/core/text/normalize';
import { instantToWall } from '@/core/time/zone';
import { eventColor, taskColor, useData } from '@/data/store';
import { formatShortDate, useLocale, useT } from '@/i18n';
import { HoverPressable, Txt } from '@/ui/primitives';
import { font, radius, text, useTheme } from '@/ui/theme';

import { eventTimeLabel } from '../calendar/shared';
import { useUi } from '../calendar/ui-store';

const MAX = 40;

export function SearchDialog() {
  const open = useUi((s) => s.searchOpen);
  if (!open) return null;
  return <SearchBody />;
}

function SearchBody() {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const [q, setQ] = useState('');
  const { events, tasks, calendars, settings } = useData();
  const close = () => useUi.getState().setSearch(false);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const out: { kind: 'event' | 'task'; id: string; title: string; sub: string; color: string; day: string | null; recurring: boolean }[] = [];
    for (const e of Object.values(events)) {
      if (e.deletedAt || e.recurrenceMasterId) continue;
      const cal = calendars[e.calendarId];
      if (!cal || cal.deletedAt) continue;
      if (!matchesQuery(`${e.title} ${e.location} ${e.description} ${cal.name}`, q)) continue;
      const day = e.allDay ? e.start : instantToWall(e.start, settings.timeZone).day;
      out.push({
        kind: 'event',
        id: e.id,
        title: e.title,
        sub: [formatShortDate(locale, day), e.allDay ? T('allDay') : eventTimeLabel(e, settings.timeZone, settings.timeFormat), e.location, cal.name]
          .filter(Boolean)
          .join(' · '),
        color: eventColor(e, calendars),
        day,
        recurring: !!e.recurrence,
      });
    }
    for (const tk of Object.values(tasks)) {
      if (tk.deletedAt) continue;
      const cal = tk.calendarId ? calendars[tk.calendarId] : undefined;
      if (!matchesQuery(`${tk.title} ${tk.notes} ${tk.tags.join(' ')} ${cal?.name ?? ''}`, q)) continue;
      out.push({
        kind: 'task',
        id: tk.id,
        title: tk.title,
        sub: [T(`st.${tk.status}` as never), tk.dueDay ? formatShortDate(locale, tk.dueDay) : T('noDate'), cal?.name].filter(Boolean).join(' · '),
        color: taskColor(tk, calendars),
        day: tk.dueDay,
        recurring: !!tk.recurrence,
      });
    }
    // Upcoming first, then most recent past.
    return out
      .sort((a, b) => (a.day ?? '9999') < (b.day ?? '9999') ? 1 : -1)
      .slice(0, MAX);
  }, [q, events, tasks, calendars, settings, locale, T]);

  function openResult(r: (typeof results)[number]) {
    close();
    if (r.kind === 'task') {
      useUi.getState().openTask(r.id);
      return;
    }
    const e = useData.getState().events[r.id];
    if (!e) return;
    if (r.day) useUi.getState().setCursor(r.day);
    useUi.getState().openEditor({ mode: 'edit', id: r.id, instance: asInstance(e) });
    router.replace('/calendar');
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]} onPress={close} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.box, { backgroundColor: t.bg, borderColor: t.border, shadowColor: t.shadow }]}>
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={T('searchPlaceholder')}
            placeholderTextColor={t.textFaint}
            onSubmitEditing={() => results[0] && openResult(results[0])}
            style={[styles.input, { color: t.text, borderBottomColor: t.border }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          />
          <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
            {q.trim() && !results.length ? (
              <Txt color="textMuted" style={{ padding: 16 }}>
                {T('noResults')}
              </Txt>
            ) : null}
            {results.map((r) => {
              const Icon = r.kind === 'task' ? CheckSquare : CalendarDays;
              return (
                <HoverPressable
                  key={`${r.kind}:${r.id}`}
                  onPress={() => openResult(r)}
                  style={({ hovered }) => [styles.row, hovered && { backgroundColor: t.surfaceAlt }]}
                >
                  <Icon size={16} color={r.color} strokeWidth={2} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt weight="medium" numberOfLines={1}>
                      {r.title}
                    </Txt>
                    <Txt size="xs" color="textMuted" numberOfLines={1}>
                      {r.sub}
                    </Txt>
                  </View>
                  {r.recurring ? <Repeat size={14} color={t.textFaint} strokeWidth={1.75} /> : null}
                </HoverPressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 16 },
  box: { width: '100%', maxWidth: 620, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden', shadowOpacity: 1, shadowRadius: 24 },
  input: { fontFamily: font.regular, fontSize: text.lg, paddingHorizontal: 16, height: 52, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
});
