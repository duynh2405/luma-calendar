/** Agenda / schedule: continuous list of upcoming days that have events. */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { dayInfo } from '@/core/lunar/dayinfo';
import { eventDayRange } from '@/core/layout/layout';
import { addDays, type DayKey, maxDay } from '@/core/time/days';
import { instantToWall, todayKey } from '@/core/time/zone';
import { eventColor } from '@/data/store';
import { formatShortDate, lunarFullLabel, useLocale, useT } from '@/i18n';
import { Button, HoverPressable, Txt } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

import { type DisplayEvent, openInstance } from './actions';
import { eventTimeLabel, keyOf, useCalendarData, useDisplayEvents } from './shared';

const PAGE_DAYS = 60;

export function AgendaView({ cursor }: { cursor: DayKey }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { calendars, settings, tz } = useCalendarData();
  const [span, setSpan] = useState(PAGE_DAYS);
  const events = useDisplayEvents(cursor, addDays(cursor, span - 1));
  const today = todayKey(tz);

  const groups = useMemo(() => {
    const end = addDays(cursor, span - 1);
    const byDay = new Map<DayKey, DisplayEvent[]>();
    for (const e of events) {
      const r = eventDayRange(e, tz);
      if (r.last < cursor || r.first > end) continue;
      for (let d = maxDay(r.first, cursor); d <= r.last && d <= end; d = addDays(d, 1)) {
        const list = byDay.get(d) ?? [];
        list.push(e);
        byDay.set(d, list);
      }
    }
    const sortKey = (e: DisplayEvent) => (e.allDay ? -1 : instantToWall(e.start, tz).minutes);
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, list]) => ({ day, list: list.sort((a, b) => sortKey(a) - sortKey(b)) }));
  }, [events, cursor, span, tz]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4, maxWidth: 820, width: '100%', alignSelf: 'center' }}>
      {groups.length === 0 ? (
        <Txt color="textMuted" style={{ padding: 24, textAlign: 'center' }}>
          {T('noEvents')}
        </Txt>
      ) : null}
      {groups.map(({ day, list }) => {
        const info = dayInfo(day);
        return (
          <View key={day} style={[styles.group, { borderBottomColor: t.border }]}>
            <View style={styles.dateCol}>
              <Txt weight="semibold" color={day === today ? 'accent' : 'text'}>
                {formatShortDate(locale, day)}
              </Txt>
              {settings.showLunar ? (
                <Txt size="xs" color="textFaint">
                  {lunarFullLabel(T, info.lunar)}
                </Txt>
              ) : null}
              {settings.showHolidays && info.holidays[0] ? (
                <Txt size="xs" color="holiday">
                  {info.holidays.map((h) => h.name[locale]).join(' · ')}
                </Txt>
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              {list.map((e) => (
                <HoverPressable
                  key={keyOf(e)}
                  onPress={() => openInstance(e)}
                  style={({ hovered }: { hovered?: boolean }) => [styles.row, hovered && { backgroundColor: t.surfaceHover }]}
                  accessibilityRole="button"
                >
                  <View style={[styles.dot, { backgroundColor: eventColor(e, calendars) }]} />
                  <Txt size="sm" color="textMuted" tabular style={{ width: 110 }}>
                    {e.task ? T('taskLabel') : e.allDay ? T('allDay') : eventTimeLabel(e, tz, settings.timeFormat)}
                  </Txt>
                  <View style={{ flex: 1 }}>
                    <Txt
                      weight="medium"
                      numberOfLines={1}
                      style={e.task?.status === 'done' ? { textDecorationLine: 'line-through' } : undefined}
                    >
                      {e.title}
                    </Txt>
                    {e.location ? (
                      <Txt size="sm" color="textMuted" numberOfLines={1}>
                        {e.location}
                      </Txt>
                    ) : null}
                  </View>
                </HoverPressable>
              ))}
            </View>
          </View>
        );
      })}
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Button label={`+${PAGE_DAYS} ${T('day').toLowerCase()}`} size="sm" onPress={() => setSpan((s) => s + PAGE_DAYS)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  dateCol: { width: 200, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
