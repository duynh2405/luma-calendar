import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dayInfo } from '@/core/lunar/dayinfo';
import { addMonths, type DayKey, monthGridDays, parseDayKey } from '@/core/time/days';
import { todayKey } from '@/core/time/zone';
import { useData } from '@/data/store';
import { formatMonthYear, useLocale, useT, weekdayShort } from '@/i18n';
import { HoverPressable, IconButton, Txt } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

export function MiniMonth({ selected, onSelect }: { selected: DayKey; onSelect: (d: DayKey) => void }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { weekStart, timeZone, showLunar } = useData((s) => s.settings);
  const [month, setMonth] = useState(selected);
  const [lastSelected, setLastSelected] = useState(selected);
  // Follow the main calendar when it navigates (adjusting state during render, not in an effect).
  if (selected !== lastSelected) {
    setLastSelected(selected);
    setMonth(selected);
  }
  const days = monthGridDays(month, weekStart);
  const today = todayKey(timeZone);
  const { m } = parseDayKey(month);

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.header}>
        <Txt weight="semibold" style={{ flex: 1 }}>
          {formatMonthYear(locale, month)}
        </Txt>
        <IconButton icon={ChevronLeft} title={T('prev')} size="sm" onPress={() => setMonth(addMonths(month, -1))} />
        <IconButton icon={ChevronRight} title={T('next')} size="sm" onPress={() => setMonth(addMonths(month, 1))} />
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
            const marker = showLunar && dayInfo(d).isLunarMarker;
            return (
              <HoverPressable
                key={d}
                onPress={() => onSelect(d)}
                accessibilityRole="button"
                accessibilityLabel={d}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.cell,
                  styles.day,
                  hovered && { backgroundColor: t.surfaceAlt },
                  isSel && { backgroundColor: t.accentSoft },
                  isToday && { backgroundColor: t.accent },
                ]}
              >
                <Txt
                  size="xs"
                  weight={isToday || isSel ? 'semibold' : 'regular'}
                  color={isToday ? 'accentText' : inMonth ? 'text' : 'textFaint'}
                  tabular
                >
                  {Number(d.slice(8))}
                </Txt>
                {marker ? <View style={[styles.marker, { backgroundColor: isToday ? t.accentText : t.holiday }]} /> : null}
              </HoverPressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 26 },
  day: { borderRadius: 13, maxWidth: 30, marginHorizontal: 'auto' } as object,
  marker: { position: 'absolute', bottom: 2, width: 3, height: 3, borderRadius: 2 },
});
