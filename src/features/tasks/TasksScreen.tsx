/** Task lists: Inbox, Today, Upcoming, All, Completed and per category. */
import { CalendarRange, CheckCheck, Inbox, Layers, Search, Sun } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Task } from '@/core/model/types';
import { bucketTasks, isOpen } from '@/core/tasks/tasks';
import { addDays } from '@/core/time/days';
import { todayKey } from '@/core/time/zone';
import { activeCalendars, useData, visibleTasks } from '@/data/store';
import { formatLongDate, useLocale, useT } from '@/i18n';
import { CalendarIcon } from '@/ui/icons';
import { HoverPressable, IconButton, Txt } from '@/ui/primitives';
import { radius, space, useTheme } from '@/ui/theme';

import { useUi } from '../calendar/ui-store';
import { QuickAdd } from '../quickadd/QuickAdd';
import { AppShell, useLayout } from '../shell/AppShell';
import { TaskRow } from './TaskRow';

type Filter = 'inbox' | 'today' | 'upcoming' | 'all' | 'done' | `cal:${string}`;

export function TasksScreen() {
  return (
    <AppShell active="tasks" onCreate={() => useUi.getState().focusQuickAdd()}>
      <TasksContent />
    </AppShell>
  );
}

function TasksContent() {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { isTablet } = useLayout();
  const calendars = useData((s) => s.calendars);
  const tasksMap = useData((s) => s.tasks);
  const tz = useData((s) => s.settings.timeZone);
  const [filter, setFilter] = useState<Filter>('today');
  const quickKey = useUi((s) => s.quickAddNonce);
  const today = todayKey(tz);

  const all = useMemo(() => visibleTasks(calendars, tasksMap), [calendars, tasksMap]);
  const buckets = useMemo(() => bucketTasks(all, today), [all, today]);
  const topOpen = all.filter((x) => isOpen(x) && !x.parentId);

  const counts: Record<string, number> = {
    inbox: buckets.inbox.length,
    today: buckets.today.length + buckets.overdue.length,
    upcoming: buckets.upcoming.length,
    all: topOpen.length,
  };

  const filters: { key: Filter; label: string; icon: ReactNode }[] = [
    { key: 'inbox', label: T('inbox'), icon: <Inbox size={16} color={t.textMuted} strokeWidth={1.75} /> },
    { key: 'today', label: T('today'), icon: <Sun size={16} color={t.textMuted} strokeWidth={1.75} /> },
    { key: 'upcoming', label: T('upcoming'), icon: <CalendarRange size={16} color={t.textMuted} strokeWidth={1.75} /> },
    { key: 'all', label: T('allTasks'), icon: <Layers size={16} color={t.textMuted} strokeWidth={1.75} /> },
    { key: 'done', label: T('completedTasks'), icon: <CheckCheck size={16} color={t.textMuted} strokeWidth={1.75} /> },
    ...activeCalendars(calendars).map((c) => ({
      key: `cal:${c.id}` as Filter,
      label: c.name,
      icon: <CalendarIcon name={c.icon} size={16} color={c.color} />,
    })),
  ];

  let sections: { title: string; tasks: Task[] }[];
  if (filter === 'inbox') sections = [{ title: T('inbox'), tasks: buckets.inbox }];
  else if (filter === 'today')
    sections = [
      { title: T('overdue'), tasks: buckets.overdue },
      { title: formatLongDate(locale, today), tasks: buckets.today },
    ];
  else if (filter === 'upcoming') {
    const byDay = new Map<string, Task[]>();
    for (const x of buckets.upcoming) byDay.set(x.dueDay!, [...(byDay.get(x.dueDay!) ?? []), x]);
    sections = [...byDay.entries()].map(([d, list]) => ({ title: d === addDays(today, 1) ? `${formatLongDate(locale, d)}` : formatLongDate(locale, d), tasks: list }));
  } else if (filter === 'all')
    sections = [
      { title: T('overdue'), tasks: buckets.overdue },
      { title: T('today'), tasks: buckets.today },
      { title: T('upcoming'), tasks: buckets.upcoming },
      { title: T('noDate'), tasks: buckets.noDate },
      { title: T('inbox'), tasks: buckets.inbox },
      { title: T('unscheduled'), tasks: topOpen.filter((x) => x.dueDay && x.dueDay > addDays(today, 7)) },
    ];
  else if (filter === 'done')
    sections = [
      {
        title: T('completedTasks'),
        tasks: all
          .filter((x) => x.status === 'done' && !x.parentId)
          .sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1))
          .slice(0, 200),
      },
    ];
  else {
    const id = filter.slice(4);
    const list = topOpen.filter((x) => x.calendarId === id).sort((a, b) => (a.dueDay ?? '9999') < (b.dueDay ?? '9999') ? -1 : 1);
    sections = [{ title: calendars[id]?.name ?? '', tasks: list }];
  }
  sections = sections.filter((s) => s.tasks.length);

  const filterList = (
    <View style={isTablet ? { gap: 2 } : styles.chipRow}>
      {filters.map((f) => {
        const on = f.key === filter;
        return (
          <HoverPressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ hovered }) => [
              isTablet ? styles.filterRow : [styles.chip, { borderColor: on ? t.accent : t.border }],
              (hovered || on) && { backgroundColor: on ? t.accentSoft : t.surfaceAlt },
            ]}
          >
            {f.icon}
            <Txt size="sm" weight={on ? 'semibold' : 'regular'} style={isTablet ? { flex: 1 } : undefined} numberOfLines={1}>
              {f.label}
            </Txt>
            {counts[f.key] ? (
              <Txt size="xs" color="textMuted" tabular>
                {counts[f.key]}
              </Txt>
            ) : null}
          </HoverPressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.toolbar, { borderBottomColor: t.border }]}>
        <Txt size="xl" weight="semibold" style={{ flex: 1 }}>
          {T('navTasks')}
        </Txt>
        <IconButton icon={Search} title={`${T('search')} (Ctrl+K)`} onPress={() => useUi.getState().setSearch(true)} />
      </View>
      <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
        {isTablet ? (
          <ScrollView style={[styles.filters, { borderRightColor: t.border }]} contentContainerStyle={{ padding: space.sm }}>
            {filterList}
          </ScrollView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: space.sm }}>
            {filterList}
          </ScrollView>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.main}>
          <QuickAdd key={quickKey} autoFocus={quickKey > 0} />
          {sections.length === 0 ? (
            <Txt color="textMuted" style={{ padding: 24, textAlign: 'center' }}>
              {T('noTasks')}
            </Txt>
          ) : null}
          {sections.map((s) => (
            <View key={s.title} style={{ gap: 4 }}>
              <Txt size="sm" weight="semibold" color={s.title === T('overdue') ? 'danger' : 'textMuted'}>
                {s.title} · {s.tasks.length}
              </Txt>
              <View style={[styles.list, { borderColor: t.border }]}>
                {s.tasks.map((x) => (
                  <TaskRow key={x.id} task={x} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: space.md, borderBottomWidth: 1 },
  filters: { width: 220, flexGrow: 0, borderRightWidth: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingHorizontal: 8, borderRadius: radius.md },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1 },
  main: { padding: space.lg, gap: space.lg, maxWidth: 860, width: '100%', alignSelf: 'center', paddingBottom: 120 },
  list: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
});
