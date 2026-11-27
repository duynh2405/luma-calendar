/** Navigation helpers shared by the sidebar, bottom tabs and shortcuts. */
import { router } from 'expo-router';
import { CalendarDays, CheckSquare, type LucideIcon, Settings, Sun } from 'lucide-react-native';

import { nowWall } from '@/core/time/zone';
import { useData } from '@/data/store';
import type { T } from '@/i18n';

import { newDraft, openCreate } from '../calendar/shared';
import { useUi } from '../calendar/ui-store';

export type Section = 'today' | 'calendar' | 'tasks';

export const SECTION_ROUTES: Record<Section, '/' | '/calendar' | '/tasks'> = {
  today: '/',
  calendar: '/calendar',
  tasks: '/tasks',
};

export function navItems(T: T): { key: Section | 'settings'; label: string; icon: LucideIcon }[] {
  return [
    { key: 'today', label: T('todayTitle'), icon: Sun },
    { key: 'calendar', label: T('navCalendar'), icon: CalendarDays },
    { key: 'tasks', label: T('navTasks'), icon: CheckSquare },
    { key: 'settings', label: T('settings'), icon: Settings },
  ];
}

/**
 * Main sections replace each other (only one is mounted, so shortcuts and dialogs
 * never run twice); Settings is pushed on top so Back returns to where you were.
 */
export function goTo(key: Section | 'settings') {
  if (key === 'settings') router.push('/settings');
  else router.replace(SECTION_ROUTES[key]);
}

/** Default "create" action: a new event at the next full hour on the current day. */
export function createEventNow() {
  const { settings } = useData.getState();
  const now = nowWall(settings.timeZone);
  const start = Math.min(23 * 60, (Math.floor(now.minutes / 60) + 1) * 60);
  openCreate(newDraft(useUi.getState().cursor ?? now.day, start, start + settings.defaultDurationMin));
}
