/**
 * Month grid: 6 weeks. Each cell shows the solar date, lunar date and holiday;
 * events are bars laid out per week row (multi-day events span cells).
 * Mouse: drag an event to another day. Click empty cell → new all-day event.
 */
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, type PointerEvent as RNPointerEvent, StyleSheet, View } from 'react-native';

import { dayInfo } from '@/core/lunar/dayinfo';
import { layoutSpanRowVisible } from '@/core/layout/layout';
import { shiftEvent } from '@/core/model/draft';
import type { CalendarEvent } from '@/core/model/types';
import { type DayKey, diffDays, isWeekend, monthGridDays, parseDayKey } from '@/core/time/days';
import { todayKey } from '@/core/time/zone';
import { useData } from '@/data/store';
import { lunarCellLabel, useLocale, useT, weekdayShort } from '@/i18n';
import { Txt } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

import { safely } from './actions';
import { clamp, EventBar, newDraft, openCreate, useCalendarData } from './shared';
import { pointFrom, type Pt, rectOf, usePointerDrag } from './use-pointer-drag';
import { useUi } from './ui-store';

const BAR_H = 22;
const CELL_HEADER = 26;

export function MonthView({ cursor }: { cursor: DayKey }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { events, settings, tz } = useCalendarData();
  const editor = useUi((s) => s.editor);
  const openEditor = useUi((s) => s.openEditor);
  const gridRef = useRef<ComponentRef<typeof View>>(null);
  const [rowHeight, setRowHeight] = useState(100);
  const [preview, setPreview] = useState<{ event: CalendarEvent; deltaDays: number } | null>(null);

  const allDays = useMemo(() => monthGridDays(cursor, settings.weekStart), [cursor, settings.weekStart]);
  const cols = settings.showWeekends ? 7 : 5;
  const weeks = useMemo(() => {
    const rows: DayKey[][] = [];
    for (let i = 0; i < 6; i++) {
      const row = allDays.slice(i * 7, i * 7 + 7);
      rows.push(settings.showWeekends ? row : row.filter((d) => !isWeekend(d)));
    }
    return rows;
  }, [allDays, settings.showWeekends]);

  const displayEvents = useMemo(() => {
    if (!preview) return events;
    const ghost = { ...preview.event, ...shiftEvent(preview.event, tz, preview.deltaDays * 1440) } as CalendarEvent;
    return events.map((e) => (e.id === ghost.id ? ghost : e));
  }, [events, preview, tz]);

  const rowBars = useMemo(
    () => weeks.map((row) => layoutSpanRowVisible(displayEvents, row, tz, true)),
    [weeks, displayEvents, tz],
  );

  const { m: curMonth } = parseDayKey(cursor);
  const today = todayKey(tz);
  const maxLanes = Math.max(0, Math.floor((rowHeight - CELL_HEADER - 4) / BAR_H));

  function cellAt(pt: Pt): DayKey | null {
    const r = rectOf(gridRef);
    if (!r) return null;
    const c = clamp(Math.floor(((pt.x - r.left) / r.width) * cols), 0, cols - 1);
    const w = clamp(Math.floor(((pt.y - r.top) / r.height) * 6), 0, 5);
    return weeks[w][c] ?? null;
  }

  const beginDrag = usePointerDrag<{ event: CalendarEvent; day: DayKey }>({
    onMove(pt, _s, d) {
      const day = cellAt(pt);
      if (day) setPreview({ event: d.event, deltaDays: diffDays(day, d.day) });
    },
    onEnd(pt, _s, d, moved) {
      setPreview(null);
      if (!moved) {
        openEditor({ mode: 'edit', id: d.event.id });
        return;
      }
      const day = cellAt(pt);
      const delta = day ? diffDays(day, d.day) : 0;
      if (delta) {
        safely(() => useData.getState().updateEvent(d.event.id, shiftEvent(d.event, tz, delta * 1440), 'event-moved'), 'event-moved');
      }
    },
    onCancel: () => setPreview(null),
  });

  const beginCellPress = usePointerDrag<{ day: DayKey }>({
    onEnd(_pt, _s, d, moved) {
      if (!moved) openCreate(newDraft(d.day, 9 * 60, 10 * 60, true));
    },
  });

  const selectedId = editor?.mode === 'edit' ? editor.id : null;
  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.weekHeader, { borderBottomColor: t.border }]}>
        {weeks[0].map((d) => (
          <View key={d} style={styles.weekHeaderCell}>
            <Txt size="xs" weight="medium" color="textMuted">
              {weekdayShort(locale, d)}
            </Txt>
          </View>
        ))}
      </View>
      <View ref={gridRef} style={{ flex: 1 }}>
        {weeks.map((row, w) => {
          const bars = rowBars[w];
          // Bars beyond the visible lanes are counted per day as "+N".
          const hiddenPerCol = new Array(row.length).fill(0);
          for (const b of bars) {
            if (b.lane >= maxLanes) for (let c = b.startCol; c < b.startCol + b.span; c++) hiddenPerCol[c]++;
          }
          const lanesShown = hiddenPerCol.some((n) => n > 0) ? Math.max(0, maxLanes - 1) : maxLanes;
          if (lanesShown < maxLanes) {
            hiddenPerCol.fill(0);
            for (const b of bars) {
              if (b.lane >= lanesShown) for (let c = b.startCol; c < b.startCol + b.span; c++) hiddenPerCol[c]++;
            }
          }
          return (
            <View
              key={w}
              style={[styles.weekRow, { borderBottomColor: t.border }]}
              onLayout={w === 0 ? (e) => setRowHeight(e.nativeEvent.layout.height) : undefined}
            >
              {row.map((d, c) => {
                const info = dayInfo(d);
                const inMonth = parseDayKey(d).m === curMonth;
                const isToday = d === today;
                const holiday = settings.showHolidays ? info.holidays[0] : undefined;
                return (
                  <Pressable
                    key={d}
                    style={[
                      styles.cell,
                      { borderLeftColor: t.border },
                      !inMonth && { backgroundColor: t.weekendTint },
                    ]}
                    onPointerDown={isWeb ? ((e: RNPointerEvent) => beginCellPress(e, { day: d })) : undefined}
                    onPress={isWeb ? undefined : () => openCreate(newDraft(d, 9 * 60, 10 * 60, true))}
                    accessibilityLabel={d}
                  >
                    <View style={styles.cellHeader}>
                      <Pressable
                        onPress={() => {
                          useUi.getState().setCursor(d);
                          useUi.getState().setView('day');
                        }}
                        onPointerDown={(e: { stopPropagation: () => void }) => e.stopPropagation()}
                        style={[styles.dateBadge, isToday && { backgroundColor: t.accent }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${T('viewDay')} ${d}`}
                      >
                        <Txt
                          size="sm"
                          weight={isToday ? 'bold' : 'semibold'}
                          color={isToday ? 'accentText' : inMonth ? 'text' : 'textFaint'}
                          tabular
                        >
                          {Number(d.slice(8)) === 1 && !isToday ? `${Number(d.slice(8))}/${parseDayKey(d).m}` : Number(d.slice(8))}
                        </Txt>
                      </Pressable>
                      {holiday ? (
                        <Txt size="xs" color="holiday" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                          {holiday.name[locale]}
                        </Txt>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}
                      {settings.showLunar ? (
                        <Txt size="xs" color={info.isLunarMarker ? 'holiday' : 'textFaint'} tabular>
                          {lunarCellLabel(info.lunar)}
                        </Txt>
                      ) : null}
                    </View>
                    {hiddenPerCol[c] > 0 ? (
                      <Pressable
                        style={[styles.more, { top: CELL_HEADER + lanesShown * BAR_H }]}
                        onPress={() => {
                          useUi.getState().setCursor(d);
                          useUi.getState().setView('day');
                        }}
                        onPointerDown={(e: { stopPropagation: () => void }) => e.stopPropagation()}
                      >
                        <Txt size="xs" weight="medium" color="textMuted">
                          {T('moreEvents', { n: hiddenPerCol[c] })}
                        </Txt>
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
              {bars
                .filter((b) => b.lane < lanesShown)
                .map((b) => (
                  <View
                    key={b.event.id}
                    style={{
                      position: 'absolute',
                      top: CELL_HEADER + b.lane * BAR_H,
                      left: `${(b.startCol / row.length) * 100}%`,
                      width: `${(b.span / row.length) * 100}%`,
                      paddingHorizontal: 3,
                    }}
                  >
                    <EventBar
                      event={b.event}
                      compact={b.span === 1 && !b.event.allDay}
                      showTime
                      continuesBefore={b.continuesBefore}
                      continuesAfter={b.continuesAfter}
                      selected={selectedId === b.event.id}
                      ghost={preview?.event.id === b.event.id}
                      onPointerDown={
                        isWeb ? (e) => beginDrag(e, { event: b.event, day: cellAt(pointFrom(e)) ?? row[b.startCol] }) : undefined
                      }
                      onPress={isWeb ? undefined : () => openEditor({ mode: 'edit', id: b.event.id })}
                    />
                  </View>
                ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekHeader: { flexDirection: 'row', borderBottomWidth: 1 },
  weekHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekRow: { flex: 1, flexDirection: 'row', borderBottomWidth: 1, minHeight: 72 },
  cell: { flex: 1, borderLeftWidth: 1, minWidth: 0 },
  cellHeader: { height: CELL_HEADER, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  dateBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  more: { position: 'absolute', left: 6, height: BAR_H, justifyContent: 'center' },
});
