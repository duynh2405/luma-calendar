/** Native (Android/iOS): schedule planned reminders as local notifications (work offline, survive restarts). */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { PlannedReminder } from '@/core/reminders/reminders';

export type Permission = 'granted' | 'denied' | 'undetermined';
const CHANNEL = 'reminders';
let ready = false;

async function setup() {
  if (ready) return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Nhắc việc',
      // eslint-disable-next-line import/namespace -- re-exported enum (export * from the types file)
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function reminderPermission(): Promise<Permission> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestReminderPermission(): Promise<Permission> {
  await setup();
  const p = await Notifications.requestPermissionsAsync();
  return p.granted ? 'granted' : 'denied';
}

/** Replace everything scheduled with `list` (ids are stable, so this is idempotent). */
export async function applyReminders(list: PlannedReminder[], body: (p: PlannedReminder) => string): Promise<void> {
  await setup();
  if ((await reminderPermission()) !== 'granted') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of list) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: body(p), data: { kind: p.kind, refId: p.refId, day: p.day } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.fireAt), channelId: CHANNEL },
    });
  }
}
