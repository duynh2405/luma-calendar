/**
 * Left column: two identical month grids, one with solar dates on top, one with lunar dates below.
 * They show the same weeks and share the selection: clicking a day in either one selects that day in both
 * (and in the main calendar). Each has a one-line summary of the selected day in its own calendar.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { canChiDay, canChiMonth, canChiYear } from '@/core/lunar/canchi';
import { dayInfo } from '@/core/lunar/dayinfo';
import { lunarCellLabel, formatLongDate, useLocale, weekdayShort } from '@/i18n';
import { lunarMonthLength } from '@/core/lunar/lunar';
import { addMonths, type DayKey, monthGridDays, parseDayKey } from '@/core/time/days';
import { todayKey } from '@/core/time/zone';
import { useData } from '@/data/store';
import { HoverPressable, IconButton, Txt } from '@/ui/primitives';
import { radius, useTheme } from '@/ui/theme';

type Mode = 'solar' | 'lunar';

export function DualMini({ selected, onSelect }: { selected: DayKey; onSelect: (d: DayKey) => void }) {
  const { weekStart } = useData((s) => s.settings);
  const [month, setMonth] = useState(selected);
  const [lastSelected, setLastSelected] = useState(selected);
  // Follow the main calendar when it navigates (adjusting state during render, not in an effect).
  if (selected !== lastSelected) {
    setLastSelected(selected);
    setMonth(selected);
  }
  const days = monthGridDays(month, weekStart);
  const nav = (n: number) => setMonth(addMonths(month, n));

  return (
    <View style={{ gap: 14 }}>
      <Grid mode="solar" days={days} month={month} selected={selected} onSelect={onSelect} onNav={nav} />
      <Grid mode="lunar" days={days} month={month} selected={selected} onSelect={onSelect} onNav={nav} />
    </View>
  );
}

function Grid({
  mode,
  days,
  month,
  selected,
  onSelect,
  onNav,
}: {
  mode: Mode;
  days: DayKey[];
  month: DayKey;
  selected: DayKey;
  onSelect: (d: DayKey) => void;
  onNav: (n: number) => void;
}) {
  const t = useTheme();
  const locale = useLocale();
  const vi = locale === 'vi';
  const { timeZone } = useData((s) => s.settings);
  const today = todayKey(timeZone);
  const { m } = parseDayKey(month);
  const lunar = mode === 'lunar';
  const accent = lunar ? t.lunar : t.accent;

  // Header: solar "Tháng 11, 2026"; lunar = the lunar month(s) covering the middle of the shown month.
  const mid = dayInfo(days[14]).lunar;
  const title = lunar
    ? vi
      ? `Âm lịch · T${mid.month}${mid.leap ? 'N' : ''} ${canChiYear(mid.year)}`
      : `Lunar · M${mid.month}${mid.leap ? 'L' : ''} ${canChiYear(mid.year)}`
    : `${vi ? 'Dương lịch' : 'Solar'} · ${m}/${parseDayKey(month).y}`;

  const sel = parseDayKey(selected);
  const sl = dayInfo(selected);
  const holidays = sl.holidays.map((h) => h.name[locale]).join(' · ');
  const len = lunarMonthLength(sl.lunar.month, sl.lunar.year, sl.lunar.leap);
  const summary = lunar
    ? [
        `${vi ? 'Ngày' : 'Day'} ${sl.lunar.day}/${sl.lunar.month}${sl.lunar.leap ? (vi ? ' nhuận' : ' leap') : ''} ${canChiYear(sl.lunar.year)}`,
        `${vi ? 'Ngày' : 'Day'} ${canChiDay(sel.d, sel.m, sel.y)} · ${vi ? 'tháng' : 'month'} ${canChiMonth(sl.lunar.month, sl.lunar.year)}${len ? ` (${len === 30 ? (vi ? 'đủ' : '30d') : vi ? 'thiếu' : '29d'})` : ''}`,
      ]
    : [formatLongDate(locale, selected), `${vi ? 'Âm lịch' : 'Lunar'}: ${sl.lunar.day}/${sl.lunar.month}${sl.lunar.leap ? 'N' : ''}`];

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.header}>
        <Txt size="sm" weight="semibold" color={lunar ? 'lunar' : 'text'} numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Txt>
        <IconButton icon={ChevronLeft} title="‹" size="sm" onPress={() => onNav(-1)} />
        <IconButton icon={ChevronRight} title="›" size="sm" onPress={() => onNav(1)} />
      </View>
      <View style={styles.row}>
        {days.slice(0, 7).map((d) => (
          <View key={d} style={styles.cell}>
            <Txt size="xs" color="textFaint">
              {weekdayShort(locale, d)}
            </Txt>
          </View>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, w) => (
        <View key={w} style={styles.row}>
          {days.slice(w * 7, w * 7 + 7).map((d) => {
            const isToday = d === today;
            const isSel = d === selected;
            const inMonth = parseDayKey(d).m === m;
            const info = dayInfo(d);
            const label = lunar ? lunarCellLabel(info.lunar) : String(parseDayKey(d).d);
            return (
              <HoverPressable
                key={d}
                onPress={() => onSelect(d)}
                accessibilityRole="button"
                accessibilityLabel={`${mode} ${d}`}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.cell,
                  styles.day,
                  hovered && { backgroundColor: t.surfaceAlt },
                  isToday && { backgroundColor: accent },
                  isSel && { borderWidth: 2, borderColor: accent },
                ]}
              >
                <Txt
                  size="xs"
                  weight={isToday || isSel || info.isLunarMarker ? 'semibold' : 'regular'}
                  color={isToday ? 'accentText' : lunar && info.isLunarMarker ? 'holiday' : inMonth ? (lunar ? 'lunar' : 'text') : 'textFaint'}
                  tabular
                >
                  {label}
                </Txt>
              </HoverPressable>
            );
          })}
        </View>
      ))}
      <View style={[styles.summary, { backgroundColor: t.surface, borderColor: t.border }]}>
        {summary.map((s, i) => (
          <Txt key={i} size="sm" weight={i === 0 ? 'semibold' : 'regular'} color={i === 0 ? (lunar ? 'lunar' : 'text') : 'textMuted'} numberOfLines={2}>
            {s}
          </Txt>
        ))}
        {holidays && !lunar ? (
          <Txt size="sm" weight="medium" color="holiday" numberOfLines={2}>
            {holidays}
          </Txt>
        ) : null}
        {lunar && sl.isLunarMarker ? (
          <Txt size="sm" weight="medium" color="holiday">
            {sl.lunar.day === 1 ? (vi ? 'Mùng một' : 'New moon') : vi ? 'Rằm' : 'Full moon'}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 26 },
  day: { borderRadius: 13, maxWidth: 30, marginHorizontal: 'auto' } as object,
  summary: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, gap: 1, marginTop: 4 },
});
