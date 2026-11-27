import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { useLocale } from '@/i18n';
import { type Permission, reminderPermission, requestReminderPermission } from '@/notifications/scheduler';
import { replanReminders } from '@/notifications/start';
import { Button, Txt } from '@/ui/primitives';

export function NotificationsPanel() {
  const vi = useLocale() === 'vi';
  const [perm, setPerm] = useState<Permission | null>(null);
  useEffect(() => {
    void reminderPermission().then(setPerm);
  }, []);

  const web = Platform.OS === 'web';
  const status =
    perm === 'granted'
      ? vi ? 'Đã bật thông báo.' : 'Notifications are on.'
      : perm === 'denied'
        ? vi ? 'Thông báo đang bị chặn — hãy bật lại trong cài đặt trình duyệt/hệ điều hành.' : 'Notifications are blocked — enable them in browser/OS settings.'
        : vi ? 'Chưa bật thông báo.' : 'Notifications are not enabled yet.';

  return (
    <View style={{ gap: 8 }}>
      <Txt size="sm" color="textMuted">{status}</Txt>
      <Txt size="sm" color="textMuted">
        {web
          ? vi
            ? 'Trên web, nhắc việc chỉ hiện khi Luma đang mở trong trình duyệt. Bản Android sẽ nhắc cả khi đóng app.'
            : 'On the web, reminders only show while Luma is open. The Android app reminds you even when closed.'
          : vi
            ? 'Nhắc việc là thông báo cục bộ: hoạt động khi không có mạng, tự đặt lại sau khi khởi động máy.'
            : 'Reminders are local notifications: they work offline and survive restarts.'}
      </Txt>
      {perm !== 'granted' ? (
        <View style={{ flexDirection: 'row' }}>
          <Button
            variant="primary"
            label={vi ? 'Bật thông báo' : 'Enable notifications'}
            onPress={async () => {
              setPerm(await requestReminderPermission());
              void replanReminders();
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
