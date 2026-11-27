import { ChevronLeft, ChevronRight, Menu, Search } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ViewMode } from '@/core/model/types';
import { type DayKey, isWeekend, rangeDays, startOfWeek } from '@/core/time/days';
import { todayKey } from '@/core/time/zone';
import { useData } from '@/data/store';
import { formatLongDate, formatMonthYear, useLocale, useT } from '@/i18n';
import { Button, IconButton, Segmented, Txt } from '@/ui/primitives';
import { space, useTheme } from '@/ui/theme';

import { AppShell, useLayout } from '../shell/AppShell';
import { AgendaView } from './AgendaView';
import { MonthView } from './MonthView';
import { TimeGridView } from './TimeGridView';
import { useUi } from './ui-store';

export function CalendarScreen() {
  return (
    <AppShell active="calendar">
      <CalendarContent />
    </AppShell>
  );
}

function CalendarContent() {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { isTablet } = useLayout();
  const settings = useData((s) => s.settings);
  const storageError = useData((s) => s.storageError);
  const view = useUi((s) => s.view);
  const cursor = useUi((s) => s.cursor)!;
  const ui = useUi.getState();

  const days = useMemo<DayKey[]>(() => {
    if (view === 'day') return [cursor];
    if (view === '3day') return rangeDays(cursor, 3);
    const week = rangeDays(startOfWeek(cursor, settings.weekStart), 7);
    return settings.showWeekends ? week : week.filter((d) => !isWeekend(d));
  }, [cursor, view, settings.weekStart, settings.showWeekends]);

  const title =
    view === 'day' ? formatLongDate(locale, cursor) : formatMonthYear(locale, view === 'week' || view === '3day' ? days[0] : cursor);

  const viewOptions: { value: ViewMode; label: string }[] = [
    { value: 'day', label: T('viewDay') },
    { value: '3day', label: T('view3day') },
    { value: 'week', label: T('viewWeek') },
    { value: 'month', label: T('viewMonth') },
    { value: 'agenda', label: T('viewAgenda') },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.toolbar, { borderBottomColor: t.border }]}>
        {!isTablet ? <IconButton icon={Menu} title="Menu" onPress={() => ui.setDrawer(true)} /> : null}
        <Button label={T('today')} size="sm" onPress={() => ui.setCursor(todayKey(settings.timeZone))} />
        <IconButton icon={ChevronLeft} title={`${T('prev')} (K)`} onPress={() => ui.step(-1)} />
        <IconButton icon={ChevronRight} title={`${T('next')} (J)`} onPress={() => ui.step(1)} />
        <Txt size={isTablet ? 'xl' : 'lg'} weight="semibold" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
          {title}
        </Txt>
        <IconButton icon={Search} title={`${T('search')} (Ctrl+K)`} onPress={() => ui.setSearch(true)} />
        {isTablet ? <Segmented value={view} onChange={ui.setView} options={viewOptions} size="sm" /> : null}
      </View>
      {!isTablet ? (
        <View style={[styles.mobileViews, { borderBottomColor: t.border }]}>
          <Segmented value={view} onChange={ui.setView} options={viewOptions} size="sm" />
        </View>
      ) : null}
      {storageError ? (
        <View style={[styles.banner, { backgroundColor: t.dangerSoft }]}>
          <Txt size="sm" color="danger">
            {T('storageError', { msg: storageError })}
          </Txt>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {view === 'month' ? <MonthView cursor={cursor} /> : view === 'agenda' ? <AgendaView cursor={cursor} /> : <TimeGridView days={days} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 56,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
  },
  mobileViews: { paddingHorizontal: space.md, paddingVertical: 6, borderBottomWidth: 1, alignItems: 'flex-start' },
  banner: { paddingHorizontal: space.md, paddingVertical: 6 },
});
