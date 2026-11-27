import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { instantToWall } from '@/core/time/zone';
import { eventColor, useData } from '@/data/store';
import { formatShortDate, useLocale, useT } from '@/i18n';
import { Button, Dialog, IconButton, Txt } from '@/ui/primitives';
import { space, useTheme } from '@/ui/theme';

import { safely } from '../calendar/actions';
import { eventTimeLabel } from '../calendar/shared';
import { Toast } from '../calendar/Toast';

export function TrashScreen() {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const events = useData((s) => s.events);
  const calendars = useData((s) => s.calendars);
  const settings = useData((s) => s.settings);
  const [confirm, setConfirm] = useState<string[] | null>(null);

  const trashed = useMemo(
    () => Object.values(events).filter((e) => e.deletedAt).sort((a, b) => (a.deletedAt! < b.deletedAt! ? 1 : -1)),
    [events],
  );
  const trashedCalendars = Object.values(calendars).filter((c) => c.deletedAt);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <IconButton icon={ArrowLeft} title={T('back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Txt size="xl" weight="semibold" style={{ flex: 1 }}>
          {T('trash')}
        </Txt>
        {trashed.length ? (
          <Button label={T('emptyTrash')} variant="danger" size="sm" onPress={() => setConfirm(trashed.map((e) => e.id))} />
        ) : null}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {trashedCalendars.map((c) => (
          <View key={c.id} style={[styles.row, { borderBottomColor: t.border }]}>
            <View style={[styles.dot, { backgroundColor: c.color }]} />
            <View style={{ flex: 1 }}>
              <Txt weight="medium">
                {T('calendar')}: {c.name}
              </Txt>
            </View>
            <Button size="sm" label={T('restore')} onPress={() => safely(() => useData.getState().restoreCalendar(c.id), 'calendar-restored')} />
          </View>
        ))}
        {trashed.length === 0 && trashedCalendars.length === 0 ? (
          <Txt color="textMuted" style={{ textAlign: 'center', padding: 32 }}>
            {T('trashEmpty')}
          </Txt>
        ) : null}
        {trashed.map((e) => {
          const day = e.allDay ? e.start : instantToWall(e.start, settings.timeZone).day;
          return (
            <View key={e.id} style={[styles.row, { borderBottomColor: t.border }]}>
              <View style={[styles.dot, { backgroundColor: eventColor(e, calendars) }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="medium" numberOfLines={1}>
                  {e.title}
                </Txt>
                <Txt size="sm" color="textMuted" numberOfLines={1}>
                  {formatShortDate(locale, day)} {e.allDay ? '' : eventTimeLabel(e, settings.timeZone, settings.timeFormat)} ·{' '}
                  {calendars[e.calendarId]?.name ?? ''}
                </Txt>
              </View>
              <Button size="sm" label={T('restore')} onPress={() => safely(() => useData.getState().restoreEvent(e.id), 'event-restored')} />
              <Button size="sm" variant="danger" label={T('deletePermanently')} onPress={() => setConfirm([e.id])} />
            </View>
          );
        })}
      </ScrollView>
      <Dialog
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={T('deletePermanently')}
        footer={
          <>
            <Button label={T('cancel')} onPress={() => setConfirm(null)} />
            <Button
              label={T('deletePermanently')}
              variant="danger"
              onPress={() => {
                if (confirm) safely(() => useData.getState().purgeEvents(confirm), 'event-purged');
                setConfirm(null);
              }}
            />
          </>
        }
      >
        <Txt>{T('purgeConfirm', { n: confirm?.length ?? 0 })}</Txt>
      </Dialog>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, paddingHorizontal: space.md, borderBottomWidth: 1 },
  content: { padding: space.lg, maxWidth: 820, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
