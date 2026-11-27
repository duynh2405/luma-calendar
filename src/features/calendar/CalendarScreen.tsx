import { ChevronLeft, ChevronRight, Menu, Plus } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ViewMode } from '@/core/model/types';
import { type DayKey, isWeekend, rangeDays, startOfWeek } from '@/core/time/days';
import { nowWall, todayKey } from '@/core/time/zone';
import { useData } from '@/data/store';
import { formatLongDate, formatMonthYear, useLocale, useT } from '@/i18n';
import { Button, IconButton, Segmented, Txt } from '@/ui/primitives';
import { BREAKPOINT, space, useTheme } from '@/ui/theme';

import { performUndo, safely } from './actions';
import { AgendaView } from './AgendaView';
import { CalendarDialog } from './CalendarDialog';
import { ConverterDialog } from './ConverterDialog';
import { EventEditor } from './EventEditor';
import { MonthView } from './MonthView';
import { newDraft, openCreate } from './shared';
import { Sidebar } from './Sidebar';
import { TimeGridView } from './TimeGridView';
import { Toast } from './Toast';
import { useUi } from './ui-store';

export function CalendarScreen() {
  const t = useTheme();
  const T = useT();
  const locale = useLocale();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const settings = useData((s) => s.settings);
  const storageError = useData((s) => s.storageError);
  const { view, cursor, editor, drawerOpen } = useUi();
  const ui = useUi.getState();

  const isDesktop = width >= BREAKPOINT.desktop;
  const isTablet = width >= BREAKPOINT.tablet;

  // Initial cursor & view.
  useEffect(() => {
    if (!cursor) {
      ui.setCursor(todayKey(settings.timeZone));
      ui.setView(width < BREAKPOINT.tablet && settings.defaultView === 'week' ? '3day' : settings.defaultView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useKeyboardShortcuts();

  const days = useMemo<DayKey[]>(() => {
    if (!cursor) return [];
    if (view === 'day') return [cursor];
    if (view === '3day') return rangeDays(cursor, 3);
    const week = rangeDays(startOfWeek(cursor, settings.weekStart), 7);
    return settings.showWeekends ? week : week.filter((d) => !isWeekend(d));
  }, [cursor, view, settings.weekStart, settings.showWeekends]);

  if (!cursor) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const title =
    view === 'day' ? formatLongDate(locale, cursor) : formatMonthYear(locale, view === 'week' || view === '3day' ? days[0] : cursor);

  const viewOptions: { value: ViewMode; label: string }[] = [
    { value: 'day', label: T('viewDay') },
    { value: '3day', label: T('view3day') },
    { value: 'week', label: T('viewWeek') },
    { value: 'month', label: T('viewMonth') },
    { value: 'agenda', label: T('viewAgenda') },
  ];

  const main = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={[styles.toolbar, { borderBottomColor: t.border }]}>
        {!isTablet ? <IconButton icon={Menu} title="Menu" onPress={() => ui.setDrawer(true)} /> : null}
        <Button label={T('today')} size="sm" onPress={() => ui.setCursor(todayKey(settings.timeZone))} />
        <IconButton icon={ChevronLeft} title={`${T('prev')} (K)`} onPress={() => ui.step(-1)} />
        <IconButton icon={ChevronRight} title={`${T('next')} (J)`} onPress={() => ui.step(1)} />
        <Txt size={isTablet ? 'xl' : 'lg'} weight="semibold" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
          {title}
        </Txt>
        {isTablet ? (
          <Segmented value={view} onChange={ui.setView} options={viewOptions} size="sm" />
        ) : null}
      </View>
      {!isTablet ? (
        <View style={[styles.mobileViews, { borderBottomColor: t.border }]}>
          <Segmented value={view} onChange={ui.setView} options={viewOptions} size="sm" />
        </View>
      ) : null}
      {storageError ? (
        <View style={[styles.banner, { backgroundColor: t.dangerSoft }]}>
          <Txt size="sm" color="danger">
            {T('storageError', { msg: storageError })}
          </Txt>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        {view === 'month' ? (
          <MonthView cursor={cursor} />
        ) : view === 'agenda' ? (
          <AgendaView cursor={cursor} />
        ) : (
          <TimeGridView days={days} />
        )}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg, paddingTop: insets.top }}>
      {isTablet ? (
        <View style={[styles.sidebar, { borderRightColor: t.border, backgroundColor: t.bg, width: isDesktop ? 264 : 232 }]}>
          <Sidebar />
        </View>
      ) : null}
      {main}

      {editor && isTablet ? (
        <View
          style={[
            styles.panel,
            { borderLeftColor: t.border, backgroundColor: t.bg, shadowColor: t.shadow },
            !isDesktop && styles.panelOverlay,
          ]}
        >
          <EventEditor />
        </View>
      ) : null}

      {!isTablet ? (
        <>
          <Pressable
            style={[styles.fab, { backgroundColor: t.accent, shadowColor: t.shadow, bottom: 24 + insets.bottom }]}
            accessibilityRole="button"
            accessibilityLabel={T('newEvent')}
            onPress={() => {
              const now = nowWall(settings.timeZone);
              const start = Math.min(23 * 60, (Math.floor(now.minutes / 60) + 1) * 60);
              openCreate(newDraft(cursor, start, start + settings.defaultDurationMin));
            }}
          >
            <Plus size={24} color={t.accentText} strokeWidth={2} />
          </Pressable>
          <Modal visible={!!editor} animationType="slide" onRequestClose={() => ui.closeEditor()}>
            <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: t.bg }}>
              <EventEditor />
            </View>
          </Modal>
          <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => ui.setDrawer(false)}>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View style={[styles.drawer, { backgroundColor: t.bg, paddingTop: insets.top }]}>
                <Sidebar onNavigate={() => ui.setDrawer(false)} />
              </View>
              <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={() => ui.setDrawer(false)} />
            </View>
          </Modal>
        </>
      ) : null}

      <CalendarDialog />
      <ConverterDialog />
      <Toast />
    </View>
  );
}

/** Desktop keyboard shortcuts (web). Ignored while typing in a field. */
function useKeyboardShortcuts() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        performUndo();
        return;
      }
      if (e.key === 'Escape') {
        if (ui.calendarDialog || ui.converterOpen) return; // dialogs handle their own Escape
        if (ui.editor) ui.closeEditor();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (ui.calendarDialog || ui.converterOpen) return;

      const { settings } = useData.getState();
      switch (e.key) {
        case 't':
        case 'T':
          ui.setCursor(todayKey(settings.timeZone));
          break;
        case 'd':
          ui.setView('day');
          break;
        case 'x':
          ui.setView('3day');
          break;
        case 'w':
          ui.setView('week');
          break;
        case 'm':
          ui.setView('month');
          break;
        case 'a':
          ui.setView('agenda');
          break;
        case 'j':
        case 'n':
        case 'ArrowRight':
          ui.step(1);
          break;
        case 'k':
        case 'p':
        case 'ArrowLeft':
          ui.step(-1);
          break;
        case 'c': {
          const now = nowWall(settings.timeZone);
          const start = Math.min(23 * 60, (Math.floor(now.minutes / 60) + 1) * 60);
          openCreate(newDraft(ui.cursor ?? now.day, start, start + settings.defaultDurationMin));
          break;
        }
        case 'Delete':
        case 'Backspace':
          if (ui.editor?.mode === 'edit') {
            const id = ui.editor.id;
            safely(() => useData.getState().deleteEvent(id), 'event-deleted');
            ui.closeEditor();
          }
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    // Capture phase: text inputs may stop propagation of Escape.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 56,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
  },
  mobileViews: { paddingHorizontal: space.md, paddingVertical: 6, borderBottomWidth: 1, alignItems: 'flex-start' },
  banner: { paddingHorizontal: space.md, paddingVertical: 6 },
  sidebar: { borderRightWidth: 1 },
  panel: { width: 380, borderLeftWidth: 1 },
  panelOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: -4, height: 0 },
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  drawer: { width: 288, maxWidth: '85%' },
});
