/**
 * Upcoming jobs: the next 3–5 jobs (events and tasks with a date) counted from the day being viewed
 * in the calendar. Each job is a button: click opens its details, hover shows ✕ (delete, with confirm).
 */
import { Check, Clock, MapPin, Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { dayInfo } from '@/core/lunar/dayinfo';
import { eventDayRange } from '@/core/layout/layout';
import { taskProgress } from '@/core/tasks/tasks';
import { addDays, type DayKey, diffDays } from '@/core/time/days';
import { instantToWall, todayKey } from '@/core/time/zone';
import { eventColor } from '@/data/store';
import { formatLongDate, lunarCellLabel, useLocale, weekdayShort } from '@/i18n';
import { Button, Segmented, Txt } from '@/ui/primitives';
import { radius, space, useTheme, withAlpha } from '@/ui/theme';

import { type DisplayEvent, openInstance, requestDelete, toggleInstanceDone } from '../calendar/actions';
import { eventTimeLabel, keyOf, newDraft, openCreate, useCalendarData, useDisplayEvents } from '../calendar/shared';
import { useUi } from '../calendar/ui-store';
import { QuickAdd } from '../quickadd/QuickAdd';
import { AppShell } from '../shell/AppShell';

export function UpcomingScreen() {
  return (
    <AppShell active="upcoming" onCreate={() => useUi.getState().focusQuickAdd()}>
      <UpcomingContent />
    </AppShell>
  );
}

/** Current time, refreshed every minute (kept in state: render must stay pure). */
function useNowMs() {
  const [ms, setMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return ms;
}

function UpcomingContent() {
  const t = useTheme();
  const locale = useLocale();
  const vi = locale === 'vi';
  const { settings, tz } = useCalendarData();
  const cursor = useUi((s) => s.cursor) as DayKey;
  const nowMs = useNowMs();
  const today = todayKey(tz);
  const [count, setCount] = useState<3 | 5>(5);

  const window = useDisplayEvents(cursor, addDays(cursor, 120));
  const jobs = useMemo(() => {
    const startKey = (e: DisplayEvent) => {
      const first = eventDayRange(e, tz).first;
      const day = first < cursor ? cursor : first;
      return day + String(e.allDay || e.task ? 0 : Math.max(0, instantToWall(e.start, tz).minutes) + 1).padStart(5, '0');
    };
    return window
      .filter((e) => {
        if (e.task ? e.task.status === 'done' : !!e.doneAt) return false;
        // Viewing today: hide timed events that already ended.
        return !(cursor === today && !e.allDay && !e.task && Date.parse(e.end) <= nowMs);
      })
      .sort((a, b) => startKey(a).localeCompare(startKey(b)))
      .slice(0, count);
  }, [window, cursor, today, count, nowMs, tz]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: 2 }}>
        <Txt size="xl" weight="semibold">
          {vi ? 'Công việc sắp tới' : 'Upcoming jobs'}
        </Txt>
        <Txt size="sm" color="textMuted">
          {vi ? 'Tính từ' : 'From'} {formatLongDate(locale, cursor)}
          {cursor !== today ? (vi ? ' (ngày đang xem)' : ' (viewed day)') : ''}
        </Txt>
      </View>

      <QuickAdd autoFocus={false} />

      <View style={styles.bar}>
        <Segmented
          size="sm"
          value={count}
          onChange={setCount}
          options={[
            { value: 3, label: vi ? '3 việc' : '3 jobs' },
            { value: 5, label: vi ? '5 việc' : '5 jobs' },
          ]}
        />
        <View style={{ flex: 1 }} />
        {cursor !== today ? (
          <Button size="sm" label={vi ? 'Từ hôm nay' : 'From today'} onPress={() => useUi.getState().setCursor(today)} />
        ) : null}
        <Button
          size="sm"
          icon={Plus}
          label={vi ? 'Thêm việc' : 'Add'}
          onPress={() => openCreate(newDraft(cursor, 9 * 60, 9 * 60 + settings.defaultDurationMin, true))}
        />
      </View>

      {jobs.length === 0 ? (
        <View style={[styles.empty, { borderColor: t.border }]}>
          <Txt color="textMuted">{vi ? 'Không có việc nào sắp tới.' : 'Nothing coming up.'}</Txt>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {jobs.map((e) => (
            <JobCard key={keyOf(e)} job={e} cursor={cursor} today={today} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function JobCard({ job: e, cursor, today }: { job: DisplayEvent; cursor: DayKey; today: DayKey }) {
  const t = useTheme();
  const locale = useLocale();
  const vi = locale === 'vi';
  const { calendars, settings, tz } = useCalendarData();
  const [hover, setHover] = useState(false);
  const color = eventColor(e, calendars);
  const first = eventDayRange(e, tz).first;
  const day = first < cursor ? cursor : first;
  const info = dayInfo(day);
  const away = diffDays(day, today);
  const when =
    away < 0 ? (vi ? 'Đang diễn ra' : 'Ongoing') : away === 0 ? (vi ? 'Hôm nay' : 'Today') : away === 1 ? (vi ? 'Ngày mai' : 'Tomorrow') : vi ? `Còn ${away} ngày` : `In ${away} days`;
  const cal = calendars[e.calendarId]?.name;
  const task = e.task;
  const progress = task ? taskProgress(task, []) : null;

  return (
    <Pressable
      onPress={() => openInstance(e)}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityLabel={e.title}
      style={[
        styles.card,
        { backgroundColor: hover ? withAlpha(color, 0.1) : t.surface, borderColor: hover ? withAlpha(color, 0.5) : t.border },
      ]}
    >
      <View style={[styles.date, { backgroundColor: withAlpha(color, 0.14) }]}>
        <Txt size="xs" color="textMuted">
          {weekdayShort(locale, day)}
        </Txt>
        <Txt size="xl" weight="semibold" tabular>
          {Number(day.slice(8))}
        </Txt>
        <Txt size="xs" color="lunar" tabular>
          {lunarCellLabel(info.lunar)}
        </Txt>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => toggleInstanceDone(e)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            accessibilityLabel={vi ? 'Xong việc' : 'Mark done'}
            hitSlop={8}
            style={[styles.check, { borderColor: color }]}
          >
            {hover ? <Check size={11} color={color} strokeWidth={3} /> : null}
          </Pressable>
          <Txt weight="semibold" numberOfLines={2} style={{ flex: 1 }}>
            {e.title}
          </Txt>
        </View>
        <View style={styles.meta}>
          <Clock size={13} color={t.textMuted} strokeWidth={1.75} />
          <Txt size="sm" color="textMuted">
            {task ? (task.dueMin !== null ? eventTimeLabel(e, tz, settings.timeFormat).split(' – ')[0] : vi ? 'Hạn trong ngày' : 'Due that day') : e.allDay ? (vi ? 'Cả ngày' : 'All day') : eventTimeLabel(e, tz, settings.timeFormat)}
          </Txt>
          <Txt size="sm" color={away <= 0 ? 'accent' : 'textFaint'} weight="medium">
            · {when}
          </Txt>
        </View>
        {e.location ? (
          <View style={styles.meta}>
            <MapPin size={13} color={t.textMuted} strokeWidth={1.75} />
            <Txt size="sm" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
              {e.location}
            </Txt>
          </View>
        ) : null}
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Txt size="xs" color="textMuted" numberOfLines={1}>
            {task ? (vi ? 'Công việc' : 'Task') : vi ? 'Sự kiện' : 'Event'}
            {cal ? ` · ${cal}` : ''}
            {task && task.priority ? ` · ${['', vi ? 'Thấp' : 'Low', vi ? 'Vừa' : 'Medium', vi ? 'Cao' : 'High'][task.priority]}` : ''}
            {progress !== null && progress > 0 ? ` · ${progress}%` : ''}
            {e.recurrence ? (vi ? ' · Lặp lại' : ' · Repeats') : ''}
          </Txt>
        </View>
      </View>

      {hover ? (
        <Pressable
          onPress={() => requestDelete(e)}
          accessibilityRole="button"
          accessibilityLabel={vi ? 'Xóa' : 'Delete'}
          hitSlop={6}
          style={[styles.x, { backgroundColor: t.bg, borderColor: t.borderStrong }]}
        >
          <X size={13} color={t.textMuted} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg, padding: 28, alignItems: 'center' },
  card: { flexDirection: 'row', gap: 14, padding: 12, borderWidth: 1, borderRadius: radius.lg, alignItems: 'flex-start' },
  date: { width: 56, borderRadius: radius.md, alignItems: 'center', paddingVertical: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  x: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
