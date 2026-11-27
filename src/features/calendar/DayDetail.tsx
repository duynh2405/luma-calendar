/**
 * Detail card for the selected day, in the left column: a Solar / Lunar switch.
 * Solar: date, weekday, day of year, week number. Lunar: lunar date, Can Chi (day/month/year),
 * month length. Holidays and the day's events are shown on both tabs.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { canChiDay, canChiMonth, canChiYear } from '@/core/lunar/canchi';
import { dayInfo } from '@/core/lunar/dayinfo';
import { lunarMonthLength } from '@/core/lunar/lunar';
import { addDays, type DayKey, diffDays, parseDayKey, weekday } from '@/core/time/days';
import { eventColor } from '@/data/store';
import { formatLongDate, useLocale } from '@/i18n';
import { Segmented, Txt } from '@/ui/primitives';
import { radius, useTheme } from '@/ui/theme';

import { eventTimeLabel, keyOf, useCalendarData, useDisplayEvents } from './shared';

/** ISO-8601 week number (weeks start Monday, week 1 contains the first Thursday). */
function isoWeek(day: DayKey): number {
  const thursday = addDays(day, 3 - ((weekday(day) + 6) % 7));
  const { y } = parseDayKey(thursday);
  return Math.floor(diffDays(thursday, `${y}-01-01`) / 7) + 1;
}

export function DayDetail({ day }: { day: DayKey }) {
  const t = useTheme();
  const locale = useLocale();
  const vi = locale === 'vi';
  const { calendars, settings, tz } = useCalendarData();
  const [tab, setTab] = useState<'solar' | 'lunar'>('solar');
  const info = dayInfo(day);
  const l = info.lunar;
  const { y, m, d } = parseDayKey(day);
  const events = useDisplayEvents(day, day).slice(0, 4);

  const dayOfYear = diffDays(day, `${y}-01-01`) + 1;
  const daysInYear = diffDays(`${y + 1}-01-01`, `${y}-01-01`);
  const monthLen = lunarMonthLength(l.month, l.year, l.leap);

  const rows: [string, string][] =
    tab === 'solar'
      ? [
          [vi ? 'Ngày trong năm' : 'Day of year', `${dayOfYear}/${daysInYear}`],
          [vi ? 'Tuần' : 'Week', String(isoWeek(day))],
          [vi ? 'Còn lại trong năm' : 'Left in year', `${daysInYear - dayOfYear} ${vi ? 'ngày' : 'days'}`],
        ]
      : [
          [vi ? 'Ngày' : 'Day', canChiDay(d, m, y)],
          [vi ? 'Tháng' : 'Month', canChiMonth(l.month, l.year)],
          [vi ? 'Năm' : 'Year', canChiYear(l.year)],
          [vi ? 'Tháng âm' : 'Lunar month', monthLen ? (vi ? (monthLen === 30 ? 'Đủ (30 ngày)' : 'Thiếu (29 ngày)') : `${monthLen} days`) : '—'],
        ];

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Segmented
        size="sm"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'solar', label: vi ? 'Dương lịch' : 'Solar' },
          { value: 'lunar', label: vi ? 'Âm lịch' : 'Lunar' },
        ]}
      />

      <View style={styles.head}>
        <Txt style={{ fontSize: 44, lineHeight: 48 }} weight="semibold" color={tab === 'lunar' ? 'lunar' : 'text'} tabular>
          {tab === 'solar' ? d : l.day}
        </Txt>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="semibold" numberOfLines={2}>
            {tab === 'solar'
              ? formatLongDate(locale, day)
              : vi
                ? `Tháng ${l.month}${l.leap ? ' nhuận' : ''}, năm ${canChiYear(l.year)}`
                : `Month ${l.month}${l.leap ? ' (leap)' : ''}, ${canChiYear(l.year)}`}
          </Txt>
          <Txt size="sm" color="textMuted" numberOfLines={2}>
            {tab === 'solar'
              ? `${vi ? 'Âm lịch' : 'Lunar'}: ${l.day}/${l.month}${l.leap ? 'N' : ''}`
              : `${vi ? 'Dương lịch' : 'Solar'}: ${d}/${m}/${y}`}
          </Txt>
        </View>
      </View>

      {info.holidays.length || info.isLunarMarker ? (
        <View style={{ gap: 2 }}>
          {info.holidays.map((h) => (
            <Txt key={h.key} size="sm" weight="medium" color="holiday">
              {h.name[locale]}
            </Txt>
          ))}
          {info.isLunarMarker && !info.holidays.length ? (
            <Txt size="sm" weight="medium" color="holiday">
              {l.day === 1 ? (vi ? 'Mùng một âm lịch' : 'Lunar new moon (day 1)') : vi ? 'Rằm (15 âm lịch)' : 'Full moon (day 15)'}
            </Txt>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Txt size="sm" color="textMuted">
              {k}
            </Txt>
            <Txt size="sm" weight="medium" color={tab === 'lunar' ? 'lunar' : 'text'} tabular>
              {v}
            </Txt>
          </View>
        ))}
      </View>

      <View style={[styles.sep, { backgroundColor: t.border }]} />
      <Txt size="xs" weight="semibold" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {vi ? 'Trong ngày' : 'On this day'}
      </Txt>
      {events.length === 0 ? (
        <Txt size="sm" color="textFaint">
          {vi ? 'Không có lịch' : 'Nothing scheduled'}
        </Txt>
      ) : (
        events.map((e) => (
          <View key={keyOf(e)} style={styles.event}>
            <View style={[styles.dot, { backgroundColor: eventColor(e, calendars) }]} />
            <Txt size="sm" numberOfLines={1} style={{ flex: 1 }} color={e.doneAt || e.task?.status === 'done' ? 'textFaint' : 'text'}>
              {e.title}
            </Txt>
            <Txt size="xs" color="textMuted" tabular>
              {e.task ? '' : e.allDay ? (vi ? 'Cả ngày' : 'All day') : eventTimeLabel(e, tz, settings.timeFormat).split(' – ')[0]}
            </Txt>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  sep: { height: 1 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
