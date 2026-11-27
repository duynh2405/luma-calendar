/** Today: the screen opened every morning. No charts — just what matters today. */
import { ChevronRight, Clock, MapPin, Search } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dayInfo } from '@/core/lunar/dayinfo';
import { eventDayRange } from '@/core/layout/layout';
import { bucketTasks, isOpen } from '@/core/tasks/tasks';
import { addDays, type DayKey } from '@/core/time/days';
import { formatMinutes, instantToWall } from '@/core/time/zone';
import { eventColor } from '@/data/store';
import { canChiLine, formatLongDate, lunarFullLabel, useLocale, useT, weekdayShort } from '@/i18n';
import { HoverPressable, IconButton, Txt } from '@/ui/primitives';
import { radius, space, useTheme } from '@/ui/theme';

import { type DisplayEvent, openInstance } from '../calendar/actions';
import { eventTimeLabel, keyOf, useCalendarData, useDisplayEvents } from '../calendar/shared';
import { useUi } from '../calendar/ui-store';
import { QuickAdd } from '../quickadd/QuickAdd';
import { AppShell, goTo, useLayout } from '../shell/AppShell';
import { TaskRow } from '../tasks/TaskRow';

export function TodayScreen() {
  return (
    <AppShell active="today" onCreate={() => useUi.getState().focusQuickAdd()}>
      <TodayContent />
    </AppShell>
  );
}

/** Current time, refreshed every 30 s (kept in state: render must stay pure). */
function useNow(tz: string) {
  const [ms, setMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return { ...instantToWall(ms, tz), ms };
}

function startMinOn(e: DisplayEvent, day: DayKey, tz: string): number {
  if (e.allDay) return -1;
  const s = instantToWall(e.start, tz);
  return s.day < day ? 0 : s.minutes;
}
function endMinOn(e: DisplayEvent, day: DayKey, tz: string): number {
  if (e.allDay) return 1440;
  const en = instantToWall(e.end, tz);
  return en.day > day ? 1440 : en.minutes;
}

function TodayContent() {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { isTablet, isDesktop } = useLayout();
  const { calendars, tasks, settings, tz } = useCalendarData();
  const quickKey = useUi((s) => s.quickAddNonce);
  const now = useNow(tz);
  const today = now.day;
  const weekEnd = addDays(today, 7);
  const instances = useDisplayEvents(today, weekEnd);
  const info = dayInfo(today);

  const todays = useMemo(
    () =>
      instances
        .filter((e) => !e.task && eventDayRange(e, tz).first <= today && eventDayRange(e, tz).last >= today)
        .sort((a, b) => startMinOn(a, today, tz) - startMinOn(b, today, tz)),
    [instances, today, tz],
  );
  const next = useMemo(
    () =>
      instances
        .filter((e) => !e.task && !e.allDay && Date.parse(e.end) > now.ms)
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0],
    [instances, now.ms],
  );

  const freeSlots = useMemo(() => {
    const busy = todays
      .filter((e) => !e.allDay)
      .map((e) => [startMinOn(e, today, tz), endMinOn(e, today, tz)] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    const slots: [number, number][] = [];
    let cur = Math.max(settings.workStart, Math.ceil(now.minutes / 15) * 15);
    for (const [s, e] of busy) {
      if (s > cur && Math.min(s, settings.workEnd) - cur >= 30) slots.push([cur, Math.min(s, settings.workEnd)]);
      cur = Math.max(cur, e);
    }
    if (settings.workEnd - cur >= 30) slots.push([cur, settings.workEnd]);
    return slots;
  }, [todays, today, tz, now.minutes, settings.workStart, settings.workEnd]);

  const buckets = useMemo(() => bucketTasks(tasks, today), [tasks, today]);
  const todayTasks = [...buckets.overdue, ...buckets.today];
  const doneToday = tasks.filter((x) => x.status === 'done' && x.completedAt && instantToWall(x.completedAt, tz).day === today).length
    + tasks.filter((x) => x.recurrence && x.completions?.some((c) => instantToWall(c.at, tz).day === today) && x.status !== 'done').length;
  const high = tasks.filter((x) => isOpen(x) && !x.parentId && x.priority === 3 && !todayTasks.includes(x));
  const unscheduled = buckets.inbox.length + buckets.noDate.length;

  const fmt = (m: number) => formatMinutes(Math.min(m, 1439), settings.timeFormat);
  const countdown = (e: DisplayEvent) => {
    const diff = Math.round((Date.parse(e.start) - now.ms) / 60000);
    if (diff <= 0) return T('happeningNow');
    if (diff < 60) return T('inMinutes', { n: diff });
    if (diff < 24 * 60) return T('inHoursMinutes', { h: Math.floor(diff / 60), m: diff % 60 });
    return formatLongDate(locale, instantToWall(e.start, tz).day);
  };

  const colStyle = isDesktop ? styles.col : styles.colStack;
  const left = (
    <View style={colStyle}>
      {next ? (
        <Card title={T('nextEvent')}>
          <Pressable onPress={() => openInstance(next)} style={[styles.next, { borderLeftColor: eventColor(next, calendars) }]}>
            <Txt size="lg" weight="semibold" numberOfLines={2}>
              {next.title}
            </Txt>
            <View style={styles.inline}>
              <Clock size={14} color={t.textMuted} strokeWidth={1.75} />
              <Txt size="sm" color="textMuted">
                {eventTimeLabel(next, tz, settings.timeFormat)} · {countdown(next)}
              </Txt>
            </View>
            {next.location ? (
              <View style={styles.inline}>
                <MapPin size={14} color={t.textMuted} strokeWidth={1.75} />
                <Txt size="sm" color="textMuted" numberOfLines={1}>
                  {next.location}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        </Card>
      ) : null}

      <Card title={T('todaySchedule')} action={() => { useUi.getState().setView('day'); goTo('calendar'); }}>
        {todays.length === 0 ? (
          <Txt size="sm" color="textMuted">
            {T('nothingToday')}
          </Txt>
        ) : (
          todays.map((e) => {
            const past = !e.allDay && endMinOn(e, today, tz) <= now.minutes;
            return (
              <HoverPressable key={keyOf(e)} onPress={() => openInstance(e)} style={({ hovered }) => [styles.eventRow, hovered && { backgroundColor: t.surfaceHover }]}>
                <View style={[styles.bar, { backgroundColor: eventColor(e, calendars) }]} />
                <Txt size="sm" color={past ? 'textFaint' : 'textMuted'} tabular style={{ width: 96 }}>
                  {e.allDay ? T('allDay') : `${fmt(startMinOn(e, today, tz))} – ${fmt(endMinOn(e, today, tz))}`}
                </Txt>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="medium" color={past ? 'textFaint' : 'text'} numberOfLines={1}>
                    {e.title}
                  </Txt>
                  {e.location ? (
                    <Txt size="xs" color="textMuted" numberOfLines={1}>
                      {e.location}
                    </Txt>
                  ) : null}
                </View>
              </HoverPressable>
            );
          })
        )}
      </Card>

      <Card title={T('freeSlots')}>
        {freeSlots.length === 0 ? (
          <Txt size="sm" color="textMuted">
            {T('noFreeSlots')}
          </Txt>
        ) : (
          <View style={styles.slots}>
            {freeSlots.map(([s, e]) => (
              <View key={s} style={[styles.slot, { backgroundColor: t.surfaceAlt }]}>
                <Txt size="sm" tabular>
                  {fmt(s)} – {fmt(e)}
                </Txt>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );

  const right = (
    <View style={colStyle}>
      <Card title={T('tasksToday')} subtitle={T('doneToday', { done: doneToday, total: doneToday + todayTasks.length })} action={() => goTo('tasks')}>
        {todayTasks.length === 0 ? (
          <Txt size="sm" color="textMuted">
            {T('noTasks')}
          </Txt>
        ) : (
          <View style={[styles.list, { borderColor: t.border }]}>
            {todayTasks.map((x) => (
              <TaskRow key={x.id} task={x} />
            ))}
          </View>
        )}
      </Card>

      {high.length ? (
        <Card title={T('highPriority')}>
          <View style={[styles.list, { borderColor: t.border }]}>
            {high.slice(0, 8).map((x) => (
              <TaskRow key={x.id} task={x} />
            ))}
          </View>
        </Card>
      ) : null}

      <Card title={T('next7')} action={() => { useUi.getState().setView('week'); goTo('calendar'); }}>
        {Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)).map((d) => {
          const items = instances.filter((e) => eventDayRange(e, tz).first <= d && eventDayRange(e, tz).last >= d);
          const evs = items.filter((e) => !e.task);
          const tks = items.filter((e) => e.task && e.task.status !== 'done');
          const di = dayInfo(d);
          return (
            <HoverPressable
              key={d}
              onPress={() => {
                useUi.getState().setCursor(d);
                useUi.getState().setView('day');
                goTo('calendar');
              }}
              style={({ hovered }) => [styles.dayRow, { borderBottomColor: t.border }, hovered && { backgroundColor: t.surfaceHover }]}
            >
              <View style={{ width: 72 }}>
                <Txt size="sm" weight="semibold">
                  {weekdayShort(locale, d)} {Number(d.slice(8))}/{Number(d.slice(5, 7))}
                </Txt>
                {settings.showLunar ? (
                  <Txt size="xs" color={di.isLunarMarker ? 'holiday' : 'textFaint'}>
                    {di.lunar.day}/{di.lunar.month}
                    {di.lunar.leap ? 'N' : ''}
                  </Txt>
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt size="sm" numberOfLines={1} color={evs.length || tks.length ? 'text' : 'textFaint'}>
                  {evs.length || tks.length
                    ? [...evs.slice(0, 2).map((e) => (e.allDay ? e.title : `${fmt(startMinOn(e, d, tz))} ${e.title}`)), ...(tks.length ? [T('tasksCount', { n: tks.length })] : [])].join(' · ')
                    : '—'}
                </Txt>
                {settings.showHolidays && di.holidays[0] ? (
                  <Txt size="xs" color="holiday" numberOfLines={1}>
                    {di.holidays.map((h) => h.name[locale]).join(' · ')}
                  </Txt>
                ) : null}
              </View>
              {evs.length > 2 ? (
                <Txt size="xs" color="textMuted">
                  +{evs.length - 2}
                </Txt>
              ) : null}
            </HoverPressable>
          );
        })}
      </Card>

      {unscheduled ? (
        <Card title={T('unscheduled')} action={() => goTo('tasks')}>
          <Txt size="sm" color="textMuted">
            {T('tasksCount', { n: unscheduled })} · {T('inbox')} {buckets.inbox.length}
          </Txt>
        </Card>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.toolbar, { borderBottomColor: t.border }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={isTablet ? 'xl' : 'lg'} weight="semibold" numberOfLines={1}>
            {formatLongDate(locale, today)}
          </Txt>
          {settings.showLunar ? (
            <Txt size="sm" color="textMuted" numberOfLines={1}>
              {lunarFullLabel(T, info.lunar)} · {canChiLine(T, today, info.lunar).split(', ')[0]}
              {settings.showHolidays && info.holidays.length ? ` · ${info.holidays.map((h) => h.name[locale]).join(', ')}` : ''}
            </Txt>
          ) : null}
        </View>
        <IconButton icon={Search} title={`${T('search')} (Ctrl+K)`} onPress={() => useUi.getState().setSearch(true)} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <QuickAdd key={quickKey} autoFocus={quickKey > 0} />
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: space.lg, alignItems: 'flex-start' }}>
          {left}
          {right}
        </View>
      </ScrollView>
    </View>
  );
}

function Card({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { borderColor: t.border }]}>
      <Pressable onPress={action} disabled={!action} style={styles.cardHeader} accessibilityRole={action ? 'button' : undefined}>
        <Txt size="sm" weight="semibold" color="textMuted" style={{ flex: 1 }}>
          {title}
          {subtitle ? <Txt size="sm" color="textFaint">{`  ·  ${subtitle}`}</Txt> : null}
        </Txt>
        {action ? <ChevronRight size={16} color={t.textFaint} strokeWidth={1.75} /> : null}
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.md, paddingVertical: 6, borderBottomWidth: 1 },
  page: { padding: space.lg, gap: space.lg, maxWidth: 1180, width: '100%', alignSelf: 'center', paddingBottom: 120 },
  col: { flex: 1, gap: space.lg, width: '100%', minWidth: 0 },
  colStack: { gap: space.lg, width: '100%' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  next: { borderLeftWidth: 3, paddingLeft: 10, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingRight: 6, borderRadius: radius.md },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
