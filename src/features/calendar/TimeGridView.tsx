/**
 * Day / N-day / week view: all-day band + scrollable 24h grid.
 * Mouse: click to create, drag to create a range, drag events to move,
 * drag the bottom edge to resize. Touch: tap to create / open.
 */
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, type PointerEvent as RNPointerEvent, ScrollView, StyleSheet, View } from 'react-native';

import { dayInfo } from '@/core/lunar/dayinfo';
import { layoutDay, layoutSpanRowVisible, timedSegments } from '@/core/layout/layout';
import { shiftEvent } from '@/core/model/draft';
import { type DayKey, isWeekend } from '@/core/time/days';
import { formatMinutes, instantToWall, nowWall, wallToInstant } from '@/core/time/zone';
import { eventColor } from '@/data/store';
import { lunarCellLabel, useLocale, useT, weekdayShort } from '@/i18n';
import { Txt } from '@/ui/primitives';
import { radius, useTheme, withAlpha } from '@/ui/theme';

import { changeInstanceTime, type DisplayEvent, openInstance } from './actions';
import { clamp, EventBar, keyOf, newDraft, openCreate, snap, SNAP_MIN, useCalendarData, useDisplayEvents, webProps } from './shared';
import { pointFrom, type Pt, rectOf, usePointerDrag } from './use-pointer-drag';
import { useUi } from './ui-store';

const HOUR_H = 48;
const GUTTER = 56;
const BAR_H = 22;

type Preview =
  | { kind: 'create'; day: DayKey; startMin: number; endMin: number }
  | { kind: 'move'; event: DisplayEvent; deltaMin: number }
  | { kind: 'resize'; event: DisplayEvent; end: string }
  | { kind: 'band'; event: DisplayEvent; deltaDays: number };

interface EventDragData {
  event: DisplayEvent;
  mode: 'move' | 'resize';
  col: number;
  min: number;
}

export function TimeGridView({ days }: { days: DayKey[] }) {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { calendars, settings, tz } = useCalendarData();
  const events = useDisplayEvents(days[0], days[days.length - 1]);
  const editor = useUi((s) => s.editor);
  const taskPanel = useUi((s) => s.taskPanel);
  const cursor = useUi((s) => s.cursor);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Re-render every 30 s so the "now" line moves.
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces a refresh
  const now = useMemo(() => nowWall(tz), [tz, tick]);
  const gridRef = useRef<ComponentRef<typeof View>>(null);
  const bandRef = useRef<ComponentRef<typeof View>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const y = Math.max(0, (settings.workStart / 60 - 1) * HOUR_H);
    const id = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(id);
    // Only on mount: don't jump while the user navigates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draggedId = preview && preview.kind !== 'create' ? keyOf(preview.event) : null;

  // Events as displayed, with the preview applied.
  const displayEvents = useMemo(() => {
    if (!preview || preview.kind === 'create') return events;
    const e = preview.event;
    let ghost: DisplayEvent;
    if (preview.kind === 'move') ghost = { ...e, ...shiftEvent(e, tz, preview.deltaMin) };
    else if (preview.kind === 'band') ghost = { ...e, ...shiftEvent(e, tz, preview.deltaDays * 1440) };
    else ghost = { ...e, end: preview.end };
    return events.map((x) => (keyOf(x) === keyOf(e) ? ghost : x));
  }, [events, preview, tz]);

  const segments = useMemo(() => timedSegments(displayEvents, days, tz), [displayEvents, days, tz]);
  const positioned = useMemo(
    () => new Map(days.map((d) => [d, layoutDay(segments.get(d) ?? [])])),
    [segments, days],
  );
  const bars = useMemo(() => layoutSpanRowVisible(displayEvents, days, tz, false), [displayEvents, days, tz]);
  const lanes = bars.reduce((m, b) => Math.max(m, b.lane + 1), 0);

  // Draft of an event being created in the editor, drawn as a placeholder.
  const draftPreview = useUi((s) => s.draftPreview);
  const draft = draftPreview && !draftPreview.allDay ? draftPreview : null;

  // --- geometry ---
  function gridPoint(pt: Pt) {
    const r = rectOf(gridRef);
    if (!r) return { col: 0, min: 0 };
    const col = clamp(Math.floor(((pt.x - r.left) / r.width) * days.length), 0, days.length - 1);
    const min = clamp(((pt.y - r.top) / HOUR_H) * 60, 0, 1440);
    return { col, min };
  }
  function bandCol(pt: Pt) {
    const r = rectOf(bandRef);
    if (!r) return 0;
    return clamp(Math.floor(((pt.x - r.left) / r.width) * days.length), 0, days.length - 1);
  }

  // --- create by click / drag on empty grid ---
  const beginCreate = usePointerDrag<{ col: number; min: number }>({
    onMove(pt, _s, d) {
      const g = gridPoint(pt);
      const a = Math.floor(d.min / SNAP_MIN) * SNAP_MIN;
      const b = snap(g.min);
      const startMin = Math.min(a, b);
      const endMin = Math.max(Math.max(a, b), startMin + SNAP_MIN);
      setPreview({ kind: 'create', day: days[d.col], startMin, endMin });
    },
    onEnd(pt, _s, d, moved) {
      setPreview(null);
      if (moved) {
        const g = gridPoint(pt);
        const a = Math.floor(d.min / SNAP_MIN) * SNAP_MIN;
        const b = snap(g.min);
        const startMin = Math.min(a, b);
        const endMin = Math.max(Math.max(a, b), startMin + SNAP_MIN);
        openCreate(newDraft(days[d.col], startMin, endMin));
      } else {
        const start = Math.floor(d.min / 30) * 30;
        openCreate(newDraft(days[d.col], start, start + settings.defaultDurationMin));
      }
    },
    onCancel: () => setPreview(null),
  });

  // --- move / resize timed events ---
  const beginEventDrag = usePointerDrag<EventDragData>({
    onMove(pt, _s, d) {
      const g = gridPoint(pt);
      if (d.mode === 'move') {
        setPreview({ kind: 'move', event: d.event, deltaMin: (g.col - d.col) * 1440 + snap(g.min - d.min) });
      } else {
        setPreview({ kind: 'resize', event: d.event, end: resizedEnd(d.event, days[g.col], snap(g.min)) });
      }
    },
    onEnd(pt, _s, d, moved) {
      setPreview(null);
      if (!moved) {
        openInstance(d.event);
        return;
      }
      const g = gridPoint(pt);
      if (d.mode === 'move') {
        const delta = (g.col - d.col) * 1440 + snap(g.min - d.min);
        if (delta !== 0) {
          changeInstanceTime(d.event, shiftEvent(d.event, tz, delta), 'event-moved');
        }
      } else {
        const end = resizedEnd(d.event, days[g.col], snap(g.min));
        if (end !== d.event.end) {
          changeInstanceTime(d.event, { start: d.event.start, end }, 'event-resized');
        }
      }
    },
    onCancel: () => setPreview(null),
  });

  function resizedEnd(e: DisplayEvent, day: DayKey, min: number): string {
    const end = wallToInstant(day, min, tz);
    const minEnd = Date.parse(e.start) + SNAP_MIN * 60000;
    return Date.parse(end) < minEnd ? new Date(minEnd).toISOString() : end;
  }

  // --- all-day band ---
  const beginBandDrag = usePointerDrag<{ event: DisplayEvent; col: number }>({
    onMove(pt, _s, d) {
      setPreview({ kind: 'band', event: d.event, deltaDays: bandCol(pt) - d.col });
    },
    onEnd(pt, _s, d, moved) {
      setPreview(null);
      if (!moved) {
        openInstance(d.event);
        return;
      }
      const delta = bandCol(pt) - d.col;
      if (delta) {
        changeInstanceTime(d.event, shiftEvent(d.event, tz, delta * 1440), 'event-moved');
      }
    },
    onCancel: () => setPreview(null),
  });
  const beginBandCreate = usePointerDrag<{ col: number }>({
    onEnd(_pt, _s, d, moved) {
      if (!moved) openCreate(newDraft(days[d.col], 9 * 60, 10 * 60, true));
    },
  });

  const selectedId =
    editor?.mode === 'edit' ? (editor.instance?.instanceKey ?? editor.id) : taskPanel ? `task:${taskPanel.id}` : null;
  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={[styles.headerRow, { borderBottomColor: t.border }]}>
        <View style={{ width: GUTTER }} />
        {days.map((d) => {
          const info = dayInfo(d);
          const isToday = d === now.day;
          const holiday = settings.showHolidays ? info.holidays[0] : undefined;
          return (
            <Pressable
              key={d}
              style={[styles.headerCell, days.length > 1 && d === cursor && { backgroundColor: t.accentSoft }]}
              onPress={() => {
                useUi.getState().setCursor(d);
                useUi.getState().setView('day');
              }}
              accessibilityRole="button"
              accessibilityLabel={d}
            >
              <Txt size="xs" weight="medium" color={isToday ? 'accent' : 'textMuted'}>
                {weekdayShort(locale, d)}
              </Txt>
              <View
                style={[
                  styles.dateCircle,
                  isToday && { backgroundColor: t.accent },
                  days.length > 1 && d === cursor && { borderWidth: 2, borderColor: t.accent },
                ]}
              >
                <Txt size="lg" weight="semibold" color={isToday ? 'accentText' : 'text'} tabular>
                  {Number(d.slice(8))}
                </Txt>
              </View>
              {settings.showLunar ? (
                <Txt size="xs" color={info.isLunarMarker ? 'holiday' : 'textFaint'} tabular>
                  {lunarCellLabel(info.lunar)}
                </Txt>
              ) : null}
              {holiday ? (
                <Txt size="xs" color="holiday" numberOfLines={1} style={{ maxWidth: '100%' }}>
                  {holiday.name[locale]}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* All-day band */}
      <View style={[styles.bandRow, { borderBottomColor: t.border, minHeight: Math.max(1, lanes) * BAR_H + 6 }]}>
        <View style={[styles.gutterLabel, { width: GUTTER }]}>
          <Txt size="xs" color="textFaint">
            {T('allDay')}
          </Txt>
        </View>
        <View ref={bandRef} style={{ flex: 1, flexDirection: 'row' }}>
          {days.map((d, i) => (
            <Pressable
              key={d}
              style={[styles.bandCell, { borderLeftColor: t.border }]}
              onPointerDown={isWeb ? ((e: RNPointerEvent) => beginBandCreate(e, { col: i })) : undefined}
              onPress={isWeb ? undefined : () => openCreate(newDraft(d, 9 * 60, 10 * 60, true))}
              accessibilityLabel={`${T('allDay')} ${d}`}
            />
          ))}
          {bars.map((b) => (
            <View
              key={keyOf(b.event)}
              style={{
                position: 'absolute',
                top: 3 + b.lane * BAR_H,
                left: `${(b.startCol / days.length) * 100}%`,
                width: `${(b.span / days.length) * 100}%`,
                paddingHorizontal: 2,
              }}
            >
              <EventBar
                event={b.event}
                continuesBefore={b.continuesBefore}
                continuesAfter={b.continuesAfter}
                selected={selectedId === keyOf(b.event)}
                ghost={draggedId === keyOf(b.event)}
                onPointerDown={isWeb ? (e) => beginBandDrag(e, { event: b.event as DisplayEvent, col: bandCol(pointFrom(e)) }) : undefined}
                onPress={isWeb ? undefined : () => openInstance(b.event as DisplayEvent)}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Time grid */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row' }}>
        <View style={{ width: GUTTER, height: 24 * HOUR_H }}>
          {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
            <Txt key={h} size="xs" color="textFaint" tabular style={[styles.hourLabel, { top: h * HOUR_H - 8 }]}>
              {formatMinutes(h * 60, settings.timeFormat)}
            </Txt>
          ))}
        </View>
        <View
          ref={gridRef}
          style={[{ flex: 1, height: 24 * HOUR_H, flexDirection: 'row' }, isWeb && ({ cursor: 'default' } as object)]}
        >
          {/* hour lines */}
          {Array.from({ length: 24 }, (_, h) => (
            <View
              key={h}
              pointerEvents="none"
              style={[styles.hourLine, { top: h * HOUR_H, borderTopColor: t.border }]}
            />
          ))}
          {days.map((d, col) => {
            const segs = positioned.get(d) ?? [];
            return (
              <View
                key={d}
                style={[
                  styles.dayCol,
                  { borderLeftColor: t.border },
                  isWeekend(d) && { backgroundColor: t.weekendTint },
                  days.length > 1 && d === cursor && { backgroundColor: t.accentSoft },
                ]}
                onPointerDown={isWeb ? ((e: RNPointerEvent) => beginCreate(e, gridPointFromEvent(e, col))) : undefined}
              >
                {/* outside working hours */}
                <View pointerEvents="none" style={[styles.offHours, { top: 0, height: (settings.workStart / 60) * HOUR_H, backgroundColor: withAlpha(t.textFaint, 0.06) }]} />
                <View pointerEvents="none" style={[styles.offHours, { top: (settings.workEnd / 60) * HOUR_H, bottom: 0, backgroundColor: withAlpha(t.textFaint, 0.06) }]} />

                {draft && draft.startDay === d ? (
                  <PlaceholderBlock startMin={draft.startMin} endMin={draft.endDay === d ? draft.endMin : 1440} />
                ) : null}
                {preview?.kind === 'create' && preview.day === d ? (
                  <PlaceholderBlock startMin={preview.startMin} endMin={preview.endMin} />
                ) : null}

                {segs.map((s) => {
                  const color = eventColor(s.event, calendars);
                  const top = (s.startMin / 60) * HOUR_H;
                  const height = Math.max(((s.endMin - s.startMin) / 60) * HOUR_H - 1, 18);
                  const selected = selectedId === keyOf(s.event);
                  const ghost = draggedId === keyOf(s.event);
                  const start = instantToWall(s.event.start, tz);
                  const end = instantToWall(s.event.end, tz);
                  const timeText = `${formatMinutes(start.minutes, settings.timeFormat)} – ${formatMinutes(end.minutes, settings.timeFormat)}`;
                  return (
                    <View
                      key={`${keyOf(s.event)}:${d}`}
                      style={{
                        position: 'absolute',
                        top,
                        height,
                        left: `${(s.column / s.columns) * 100}%`,
                        width: `${100 / s.columns}%`,
                        paddingRight: 2,
                        paddingLeft: 1,
                        zIndex: ghost ? 20 : selected ? 10 : 1,
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${s.event.title}, ${timeText}`}
                        {...webProps({ title: `${timeText}\n${s.event.title}${s.event.location ? '\n' + s.event.location : ''}` })}
                        onPointerDown={
                          isWeb
                            ? ((e: RNPointerEvent) => {
                                const g = gridPointFromEvent(e, col);
                                beginEventDrag(e, { event: s.event as DisplayEvent, mode: 'move', col: g.col, min: g.min });
                              })
                            : undefined
                        }
                        onPress={isWeb ? undefined : () => openInstance(s.event as DisplayEvent)}
                        style={[
                          styles.block,
                          {
                            backgroundColor: withAlpha(color, selected ? 0.4 : t.tintAlpha),
                            borderLeftColor: color,
                            opacity: ghost ? 0.85 : s.event.doneAt ? 0.55 : 1,
                            borderTopLeftRadius: s.continuesBefore ? 0 : radius.sm,
                            borderTopRightRadius: s.continuesBefore ? 0 : radius.sm,
                            borderBottomLeftRadius: s.continuesAfter ? 0 : radius.sm,
                            borderBottomRightRadius: s.continuesAfter ? 0 : radius.sm,
                          },
                          ghost && { shadowColor: t.shadow, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
                          isWeb && ({ cursor: ghost ? 'grabbing' : 'pointer' } as object),
                        ]}
                      >
                        <Txt
                          size="xs"
                          weight="semibold"
                          numberOfLines={height < 36 ? 1 : 2}
                          style={s.event.doneAt ? { textDecorationLine: 'line-through' } : undefined}
                        >
                          {s.event.title}
                          {height < 36 ? (
                            <Txt size="xs" color="textMuted">
                              {'  ' + formatMinutes(start.minutes, settings.timeFormat)}
                            </Txt>
                          ) : null}
                        </Txt>
                        {height >= 36 ? (
                          <Txt size="xs" color="textMuted" tabular numberOfLines={1}>
                            {timeText}
                          </Txt>
                        ) : null}
                        {height >= 60 && s.event.location ? (
                          <Txt size="xs" color="textMuted" numberOfLines={1}>
                            {s.event.location}
                          </Txt>
                        ) : null}
                        {!s.continuesAfter && isWeb ? (
                          <View
                            style={[styles.resizeHandle, { cursor: 'ns-resize' } as object]}
                            onPointerDown={
                              ((e: RNPointerEvent) => {
                                const g = gridPointFromEvent(e, col);
                                beginEventDrag(e, { event: s.event as DisplayEvent, mode: 'resize', col: g.col, min: g.min });
                              }) as never
                            }
                          />
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}

                {d === now.day ? (
                  <View pointerEvents="none" style={[styles.nowLine, { top: (now.minutes / 60) * HOUR_H, backgroundColor: t.nowLine }]}>
                    <View style={[styles.nowDot, { backgroundColor: t.nowLine }]} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  function gridPointFromEvent(e: { nativeEvent: unknown }, _col: number) {
    return gridPoint(pointFrom(e));
  }
}

function PlaceholderBlock({ startMin, endMin }: { startMin: number; endMin: number }) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        styles.placeholder,
        {
          top: (startMin / 60) * HOUR_H,
          height: Math.max(((endMin - startMin) / 60) * HOUR_H - 1, 18),
          borderColor: t.accent,
          backgroundColor: withAlpha(t.accent, 0.12),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 6 },
  headerCell: { flex: 1, alignItems: 'center', gap: 1, minWidth: 0, paddingHorizontal: 2 },
  dateCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bandRow: { flexDirection: 'row', borderBottomWidth: 1 },
  gutterLabel: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8 },
  bandCell: { flex: 1, borderLeftWidth: 1 },
  hourLabel: { position: 'absolute', right: 8 },
  hourLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1 },
  dayCol: { flex: 1, borderLeftWidth: 1, position: 'relative' },
  offHours: { position: 'absolute', left: 0, right: 0 },
  block: {
    flex: 1,
    borderLeftWidth: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  resizeHandle: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, zIndex: 30 },
  nowDot: { position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 5 },
  placeholder: { position: 'absolute', left: 1, right: 2, borderWidth: 1.5, borderRadius: radius.sm, zIndex: 25 },
});
