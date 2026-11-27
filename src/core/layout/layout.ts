/**
 * Layout algorithms for calendar views. Pure functions, unit-tested.
 */
import { addDays, type DayKey, diffDays, maxDay, minDay } from '../time/days';
import { instantToWall } from '../time/zone';
import type { CalendarEvent } from '../model/types';

const DAY_MIN = 1440;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Events that occupy the all-day band (or a bar in the month grid):
 * all-day events, and timed events lasting 24h or more (like Google Calendar).
 */
export function isSpanning(e: CalendarEvent): boolean {
  if (e.allDay) return true;
  return Date.parse(e.end) - Date.parse(e.start) >= DAY_MIN * 60000;
}

/** First and last (inclusive) day the event touches, in `tz`. */
export function eventDayRange(e: CalendarEvent, tz: string): { first: DayKey; last: DayKey } {
  if (e.allDay) return { first: e.start, last: addDays(e.end, -1) < e.start ? e.start : addDays(e.end, -1) };
  const s = instantToWall(e.start, tz);
  // An event ending exactly at midnight doesn't touch the next day.
  const endMs = Math.max(Date.parse(e.end) - 1, Date.parse(e.start));
  const en = instantToWall(endMs, tz);
  return { first: s.day, last: en.day };
}

// ---------------------------------------------------------------------------
// Time grid (day / week): overlapping events side by side
// ---------------------------------------------------------------------------

export interface TimedSegment {
  event: CalendarEvent;
  day: DayKey;
  /** minutes from local midnight */
  startMin: number;
  endMin: number;
  /** event continues from the previous day / into the next day */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface PositionedSegment extends TimedSegment {
  column: number;
  columns: number;
}

/** Split timed (non-spanning) events into per-day segments for the visible days. */
export function timedSegments(events: CalendarEvent[], days: DayKey[], tz: string): Map<DayKey, TimedSegment[]> {
  const out = new Map<DayKey, TimedSegment[]>(days.map((d) => [d, []]));
  if (days.length === 0) return out;
  const first = days[0];
  const last = days[days.length - 1];
  for (const e of events) {
    if (e.allDay || isSpanning(e)) continue;
    const s = instantToWall(e.start, tz);
    const en = instantToWall(e.end, tz);
    const range = eventDayRange(e, tz);
    if (range.last < first || range.first > last) continue;
    for (let d = maxDay(range.first, first); d <= minDay(range.last, last); d = addDays(d, 1)) {
      const list = out.get(d);
      if (!list) continue;
      const startMin = d === s.day ? s.minutes : 0;
      const endMin = d === en.day ? en.minutes : DAY_MIN;
      list.push({
        event: e,
        day: d,
        startMin,
        endMin: Math.max(endMin, startMin),
        continuesBefore: d !== s.day,
        continuesAfter: d !== en.day && !(en.minutes === 0 && addDays(d, 1) === en.day),
      });
    }
  }
  return out;
}

/**
 * Assign columns to overlapping segments of one day.
 * Clusters of transitively overlapping events share the same column count.
 * Very short events get a minimum visual height (`minDurationMin`) for overlap purposes.
 */
export function layoutDay(segments: TimedSegment[], minDurationMin = 20): PositionedSegment[] {
  const sorted = [...segments].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - b.startMin - (a.endMin - a.startMin) || cmpId(a, b),
  );
  const result: PositionedSegment[] = [];
  let cluster: PositionedSegment[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const p of cluster) p.columns = colEnds.length;
    result.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const seg of sorted) {
    const visualEnd = Math.max(seg.endMin, seg.startMin + minDurationMin);
    if (seg.startMin >= clusterEnd && cluster.length) flush();
    let col = colEnds.findIndex((end) => end <= seg.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(visualEnd);
    } else {
      colEnds[col] = visualEnd;
    }
    cluster.push({ ...seg, column: col, columns: 1 });
    clusterEnd = Math.max(clusterEnd, visualEnd);
  }
  if (cluster.length) flush();
  return result;
}

function cmpId(a: TimedSegment, b: TimedSegment) {
  return a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Spanning bars (all-day band, month rows): lanes
// ---------------------------------------------------------------------------

export interface SpanBar {
  event: CalendarEvent;
  /** column index within the row (0-based) */
  startCol: number;
  /** number of columns covered */
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/**
 * Lay out events as horizontal bars across a row of consecutive days.
 * `includeTimed` puts short timed events in the row too (month view).
 */
export function layoutSpanRow(
  events: CalendarEvent[],
  rowDays: DayKey[],
  tz: string,
  includeTimed: boolean,
): SpanBar[] {
  if (rowDays.length === 0) return [];
  const first = rowDays[0];
  const last = rowDays[rowDays.length - 1];
  const items: { e: CalendarEvent; f: DayKey; l: DayKey; sortKey: number }[] = [];
  for (const e of events) {
    if (!includeTimed && !isSpanning(e)) continue;
    const r = eventDayRange(e, tz);
    if (r.last < first || r.first > last) continue;
    const multi = r.first !== r.last;
    // Order: multi-day first (longest first), then all-day, then by start time.
    const startMin = e.allDay ? -1 : instantToWall(e.start, tz).minutes;
    const sortKey = (multi || e.allDay ? 0 : 1) * 1e7 - diffDays(r.last, r.first) * 1e4 + startMin;
    items.push({ e, f: r.first, l: r.last, sortKey });
  }
  items.sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : a.sortKey - b.sortKey || (a.e.id < b.e.id ? -1 : 1)));

  const laneEnds: number[] = []; // last occupied column per lane
  const bars: SpanBar[] = [];
  for (const it of items) {
    const startCol = Math.max(0, diffDays(it.f, first));
    const endCol = Math.min(rowDays.length - 1, diffDays(it.l, first));
    let lane = laneEnds.findIndex((end) => end < startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endCol);
    } else {
      laneEnds[lane] = endCol;
    }
    bars.push({
      event: it.e,
      startCol,
      span: endCol - startCol + 1,
      lane,
      continuesBefore: it.f < first,
      continuesAfter: it.l > last,
    });
  }
  return bars;
}

/**
 * Like layoutSpanRow, but for a row that skips some days (hidden weekends).
 * Bars are laid out on the full contiguous range, then mapped to visible columns.
 */
export function layoutSpanRowVisible(
  events: CalendarEvent[],
  visibleDays: DayKey[],
  tz: string,
  includeTimed: boolean,
): SpanBar[] {
  if (visibleDays.length === 0) return [];
  const first = visibleDays[0];
  const count = diffDays(visibleDays[visibleDays.length - 1], first) + 1;
  if (count === visibleDays.length) return layoutSpanRow(events, visibleDays, tz, includeTimed);
  const full = Array.from({ length: count }, (_, i) => addDays(first, i));
  const visibleIndex = new Map(visibleDays.map((d, i) => [d, i]));
  const out: SpanBar[] = [];
  for (const bar of layoutSpanRow(events, full, tz, includeTimed)) {
    const cols: number[] = [];
    for (let c = bar.startCol; c < bar.startCol + bar.span; c++) {
      const vi = visibleIndex.get(full[c]);
      if (vi !== undefined) cols.push(vi);
    }
    if (!cols.length) continue;
    out.push({
      ...bar,
      startCol: cols[0],
      span: cols.length,
      continuesBefore: bar.continuesBefore || visibleIndex.get(full[bar.startCol]) === undefined,
      continuesAfter: bar.continuesAfter || visibleIndex.get(full[bar.startCol + bar.span - 1]) === undefined,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

/** Timed events overlapping [start, end) — used for conflict warnings. */
export function findConflicts(
  events: CalendarEvent[],
  start: string,
  end: string,
  excludeId?: string,
): CalendarEvent[] {
  const s = Date.parse(start);
  const en = Date.parse(end);
  return events.filter(
    (e) => !e.allDay && e.id !== excludeId && Date.parse(e.start) < en && Date.parse(e.end) > s,
  );
}
