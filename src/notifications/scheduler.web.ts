/**
 * Web: Notification API + timers. Only reminders due within the next 24 h are armed and only while the
 * app/tab is open (a browser cannot wake a closed page without Web Push; that needs a push server, later).
 */
import type { PlannedReminder } from '@/core/reminders/reminders';

export type Permission = 'granted' | 'denied' | 'undetermined';
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export async function reminderPermission(): Promise<Permission> {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission === 'default' ? 'undetermined' : Notification.permission;
}

export async function requestReminderPermission(): Promise<Permission> {
  if (typeof Notification === 'undefined') return 'denied';
  const r = await Notification.requestPermission();
  return r === 'default' ? 'undetermined' : r;
}

export async function applyReminders(list: PlannedReminder[], body: (p: PlannedReminder) => string): Promise<void> {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  if ((await reminderPermission()) !== 'granted') return;
  const now = Date.now();
  for (const p of list) {
    const wait = Date.parse(p.fireAt) - now;
    if (wait < 0 || wait > 24 * 3600_000) continue;
    timers.set(
      p.id,
      setTimeout(() => {
        try {
          new Notification(p.title, { body: body(p), tag: p.id, icon: '/icon-192.png' });
        } catch {
          // notifications unavailable in this context
        }
      }, wait),
    );
  }
}
