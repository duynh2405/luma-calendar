/**
 * Shared app frame for the main screens (Today, Calendar, Tasks):
 * desktop/tablet → sidebar + content + side panel; phone → content + bottom tabs,
 * editor sheets and a drawer. Also hosts global dialogs and keyboard shortcuts.
 */
import { Plus } from 'lucide-react-native';
import { useIsFocused } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { asInstance } from '@/core/recurrence/expand';
import { todayKey } from '@/core/time/zone';
import { useData } from '@/data/store';
import { useT } from '@/i18n';
import { Txt } from '@/ui/primitives';
import { BREAKPOINT, useTheme } from '@/ui/theme';

import { deleteInstance, performUndo, safely } from '../calendar/actions';
import { CalendarDialog } from '../calendar/CalendarDialog';
import { ConfirmDeleteDialog } from '../calendar/ConfirmDeleteDialog';
import { ConverterDialog } from '../calendar/ConverterDialog';
import { EventEditor } from '../calendar/EventEditor';
import { ScopeDialog } from '../calendar/ScopeDialog';
import { Sidebar } from '../calendar/Sidebar';
import { Toast } from '../calendar/Toast';
import { useUi } from '../calendar/ui-store';
import { SearchDialog } from '../search/SearchDialog';
import { TaskPanel } from '../tasks/TaskPanel';
import { createEventNow, goTo, navItems, type Section } from './nav';

export { createEventNow, goTo, navItems, type Section } from './nav';

export function useLayout() {
  const { width } = useWindowDimensions();
  return { isDesktop: width >= BREAKPOINT.desktop, isTablet: width >= BREAKPOINT.tablet };
}

export function AppShell({ active, children, onCreate }: { active: Section; children: ReactNode; onCreate?: () => void }) {
  const t = useTheme();
  const T = useT();
  const insets = useSafeAreaInsets();
  const { isDesktop, isTablet } = useLayout();
  const editor = useUi((s) => s.editor);
  const taskPanel = useUi((s) => s.taskPanel);
  const drawerOpen = useUi((s) => s.drawerOpen);
  const cursor = useUi((s) => s.cursor);
  const tz = useData((s) => s.settings.timeZone);
  const ui = useUi.getState();

  useEffect(() => {
    if (!cursor) {
      const { settings } = useData.getState();
      ui.setCursor(todayKey(tz));
      ui.setView(!isTablet && settings.defaultView === 'week' ? '3day' : settings.defaultView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useKeyboardShortcuts(active);

  const panel = editor ? <EventEditor /> : taskPanel ? <TaskPanel /> : null;
  const create = onCreate ?? createEventNow;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {isTablet ? (
          <View style={[styles.sidebar, { borderRightColor: t.border, width: isDesktop ? 264 : 232 }]}>
            <Sidebar active={active} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>{cursor ? children : null}</View>
      </View>

      {/* Details open as a pop-up box, only when asked for (a click on a job or the + of a day). */}
      {panel && isTablet ? (
        <View style={styles.popupWrap} pointerEvents="box-none">
          <View style={[styles.backdrop, { backgroundColor: t.overlay }]} pointerEvents="none" />
          <View
            style={[
              styles.popup,
              { backgroundColor: t.bg, borderColor: t.border, shadowColor: t.shadow, width: isDesktop ? 460 : 420 },
            ]}
          >
            {panel}
          </View>
        </View>
      ) : null}

      {!isTablet ? (
        <>
          <Pressable
            style={[styles.fab, { backgroundColor: t.accent, shadowColor: t.shadow, bottom: 72 + insets.bottom }]}
            accessibilityRole="button"
            accessibilityLabel={T('create')}
            onPress={create}
          >
            <Plus size={24} color={t.accentText} strokeWidth={2} />
          </Pressable>
          <BottomTabs active={active} />
          <Modal visible={!!panel} animationType="slide" onRequestClose={() => (editor ? ui.closeEditor() : ui.openTask(null))}>
            <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: t.bg }}>{panel}</View>
          </Modal>
          <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => ui.setDrawer(false)}>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View style={[styles.drawer, { backgroundColor: t.bg, paddingTop: insets.top }]}>
                <Sidebar active={active} onNavigate={() => ui.setDrawer(false)} />
              </View>
              <Pressable style={{ flex: 1, backgroundColor: t.overlay }} onPress={() => ui.setDrawer(false)} />
            </View>
          </Modal>
        </>
      ) : null}

      <CalendarDialog />
      <ConverterDialog />
      <ScopeDialog />
      <ConfirmDeleteDialog />
      <SearchDialog />
      <Toast />
    </View>
  );
}

function BottomTabs({ active }: { active: Section }) {
  const t = useTheme();
  const T = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabs, { borderTopColor: t.border, backgroundColor: t.bg, paddingBottom: insets.bottom }]}>
      {navItems(T).map(({ key, label, icon: Icon }) => {
        const on = key === active;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => goTo(key)}
            style={styles.tab}
          >
            <Icon size={20} color={on ? t.accent : t.textMuted} strokeWidth={on ? 2.25 : 1.75} />
            <Txt size="xs" weight={on ? 'semibold' : 'medium'} color={on ? 'accent' : 'textMuted'}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Desktop keyboard shortcuts (web). Ignored while typing in a field. */
function useKeyboardShortcuts(active: Section) {
  // Only the visible screen listens (Settings / Trash may be pushed on top).
  const focused = useIsFocused();
  useEffect(() => {
    if (Platform.OS !== 'web' || !focused) return;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const dialogOpen = ui.calendarDialog || ui.converterOpen || ui.scopePrompt || ui.confirmDelete || ui.searchOpen;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        performUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.setSearch(true);
        return;
      }
      if (e.key === 'Escape') {
        if (dialogOpen) return; // dialogs handle their own Escape
        if (ui.editor) ui.closeEditor();
        else if (ui.taskPanel) ui.openTask(null);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || dialogOpen) return;

      const { settings, events } = useData.getState();
      const calendarKeys = active === 'calendar';
      switch (e.key) {
        case '1':
          goTo('upcoming');
          break;
        case '2':
          goTo('calendar');
          break;
        case '3':
          goTo('tasks');
          break;
        case '/':
          ui.setSearch(true);
          break;
        case 'c':
          createEventNow();
          break;
        case 't':
        case 'T':
          ui.setCursor(todayKey(settings.timeZone));
          break;
        case 'd':
        case 'x':
        case 'w':
        case 'm':
        case 'a':
          if (!calendarKeys) return;
          ui.setView(({ d: 'day', x: '3day', w: 'week', m: 'month', a: 'agenda' } as const)[e.key]);
          break;
        case 'j':
        case 'n':
        case 'ArrowRight':
          if (!calendarKeys) return;
          ui.step(1);
          break;
        case 'k':
        case 'p':
        case 'ArrowLeft':
          if (!calendarKeys) return;
          ui.step(-1);
          break;
        case 'Delete':
        case 'Backspace':
          if (ui.editor?.mode === 'edit') {
            const ev = events[ui.editor.id];
            if (ev) deleteInstance(ui.editor.instance ?? asInstance(ev), () => ui.closeEditor());
          } else if (ui.taskPanel) {
            const id = ui.taskPanel.id;
            safely(() => useData.getState().deleteTask(id), 'task-deleted');
            ui.openTask(null);
          } else return;
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    // Capture phase: text inputs may stop propagation of Escape.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, focused]);
}

const styles = StyleSheet.create({
  sidebar: { borderRightWidth: 1 },
  popupWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  popup: { maxWidth: '94%', height: '88%', maxHeight: 720, borderWidth: 1, borderRadius: 14, overflow: 'hidden', shadowOpacity: 1, shadowRadius: 40, shadowOffset: { width: 0, height: 16 } },
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
    zIndex: 10,
  },
  tabs: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 2 },
  drawer: { width: 288, maxWidth: '85%' },
});
