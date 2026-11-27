import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import type { EventDraft } from '@/core/model/draft';
import type { CalendarEvent } from '@/core/model/types';
import { addDays, type DayKey } from '@/core/time/days';
import { instantToWall, formatMinutes } from '@/core/time/zone';
import { defaultCalendarId, eventColor, useData, visibleEvents } from '@/data/store';
import { useT } from '@/i18n';
import { radius, useTheme, withAlpha } from '@/ui/theme';
import { Txt } from '@/ui/primitives';

import { useUi } from './ui-store';

export const SNAP_MIN = 15;
export const snap = (min: number, step = SNAP_MIN) => Math.round(min / step) * step;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function useCalendarData() {
  const { calendars, events, settings } = useData(
    useShallow((s) => ({ calendars: s.calendars, events: s.events, settings: s.settings })),
  );
  const visible = useMemo(() => visibleEvents(calendars, events), [calendars, events]);
  return { calendars, events: visible, settings, tz: settings.timeZone };
}

export function newDraft(day: DayKey, startMin: number, endMin: number, allDay = false, endDay = day): EventDraft | null {
  const calendarId = defaultCalendarId(useData.getState().calendars);
  if (!calendarId) return null;
  const overflow = !allDay && endMin >= 1440;
  return {
    title: '',
    calendarId,
    allDay,
    startDay: day,
    startMin,
    endDay: overflow ? addDays(endDay, Math.floor(endMin / 1440)) : endDay,
    endMin: overflow ? endMin % 1440 : endMin,
    location: '',
    description: '',
    color: null,
  };
}

export function openCreate(draft: EventDraft | null) {
  if (draft) useUi.getState().openEditor({ mode: 'create', draft });
  else useUi.getState().setCalendarDialog({ mode: 'create' });
}

export function eventTimeLabel(e: CalendarEvent, tz: string, fmt: '24h' | '12h'): string {
  if (e.allDay) return '';
  const s = instantToWall(e.start, tz);
  const en = instantToWall(e.end, tz);
  return `${formatMinutes(s.minutes, fmt)} – ${formatMinutes(en.minutes, fmt)}`;
}

/** Web-only props (title tooltip, context menu) that RN types don't declare. */
export function webProps(p: { title?: string; onContextMenu?: (e: unknown) => void }): object {
  return Platform.OS === 'web' ? p : {};
}

/** A compact event bar used in the all-day band, month grid and agenda. */
export function EventBar({
  event,
  compact,
  showTime,
  selected,
  ghost,
  continuesBefore,
  continuesAfter,
  onPointerDown,
  onPress,
}: {
  event: CalendarEvent;
  compact?: boolean;
  showTime?: boolean;
  selected?: boolean;
  ghost?: boolean;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  onPointerDown?: (e: { nativeEvent: unknown; stopPropagation?: () => void }) => void;
  onPress?: () => void;
}) {
  const t = useTheme();
  const { calendars, tz, settings } = useCalendarData();
  const color = eventColor(event, calendars);
  const solid = event.allDay || !compact;
  const time = showTime && !event.allDay ? formatMinutes(instantToWall(event.start, tz).minutes, settings.timeFormat) : '';
  return (
    <Pressable
      onPress={onPress}
      onPointerDown={onPointerDown as never}
      accessibilityRole="button"
      accessibilityLabel={`${event.title} ${time}`}
      {...webProps({ title: `${time ? time + ' ' : ''}${event.title}` })}
      style={[
        styles.bar,
        {
          backgroundColor: solid ? withAlpha(color, selected ? 0.42 : t.tintAlpha + 0.06) : 'transparent',
          borderTopLeftRadius: continuesBefore ? 0 : radius.sm,
          borderBottomLeftRadius: continuesBefore ? 0 : radius.sm,
          borderTopRightRadius: continuesAfter ? 0 : radius.sm,
          borderBottomRightRadius: continuesAfter ? 0 : radius.sm,
          opacity: ghost ? 0.55 : 1,
        },
        selected && { outlineColor: color, outlineWidth: 1, outlineStyle: 'solid' } as object,
      ]}
    >
      {!solid ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {solid && !continuesBefore ? <View style={[styles.stripe, { backgroundColor: color }]} /> : null}
      {time ? (
        <Txt size="xs" color="textMuted" tabular numberOfLines={1}>
          {time}
        </Txt>
      ) : null}
      <Txt size="xs" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
        {event.title}
      </Txt>
    </Pressable>
  );
}

export function useEventsT() {
  return useT();
}

const styles = StyleSheet.create({
  bar: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    overflow: 'hidden',
    cursor: 'pointer',
  } as object,
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
