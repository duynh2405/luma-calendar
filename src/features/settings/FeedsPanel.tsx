import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { addFeed, type Feed, loadFeeds, refreshAllFeeds, removeFeed } from '@/data/icsfeeds';
import { useLocale } from '@/i18n';
import { Button, Field, Txt } from '@/ui/primitives';

import { useUi } from '../calendar/ui-store';

/** Subscribe to calendar links (.ics / webcal): Google "secret address", Apple, Outlook… one-way into Luma. */
export function FeedsPanel() {
  const vi = useLocale() === 'vi';
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => void loadFeeds().then(setFeeds), []);
  useEffect(refresh, [refresh]);

  async function add() {
    if (!url.trim()) return;
    setBusy(true);
    const f = await addFeed(url, name);
    setBusy(false);
    if (f.lastError) useUi.getState().showToast((vi ? 'Không lấy được lịch: ' : 'Could not fetch: ') + f.lastError);
    else {
      useUi.getState().showToast(vi ? `Đã đăng ký "${f.name}" (${f.count} sự kiện)` : `Subscribed "${f.name}" (${f.count} events)`, true);
      setUrl('');
      setName('');
    }
    refresh();
  }

  return (
    <View style={{ gap: 8 }}>
      <Txt size="sm" color="textMuted">
        {vi
          ? 'Dán link lịch (.ics hoặc webcal://), ví dụ "Địa chỉ bí mật ở định dạng iCal" của Google Calendar. Luma tự cập nhật mỗi 6 giờ, một chiều (chỉnh sửa trong Luma không đẩy ngược lên nguồn). Nếu trình duyệt chặn, cần đăng nhập tài khoản Luma để dùng máy chủ trung gian.'
          : 'Paste a calendar link (.ics or webcal://), e.g. Google Calendar "Secret address in iCal format". Refreshed every 6 hours, one-way. If the browser blocks it, sign in so the relay can fetch it.'}
      </Txt>
      <Field placeholder={vi ? 'Tên lịch (tùy chọn)' : 'Name (optional)'} value={name} onChangeText={setName} />
      <Field placeholder="https://… hoặc webcal://…" value={url} onChangeText={setUrl} autoCapitalize="none" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label={vi ? 'Đăng ký' : 'Subscribe'} variant="primary" onPress={add} disabled={busy || !url.trim()} />
        {feeds.length ? (
          <Button
            label={vi ? 'Cập nhật ngay' : 'Refresh now'}
            onPress={async () => {
              setBusy(true);
              await refreshAllFeeds();
              setBusy(false);
              refresh();
            }}
            disabled={busy}
          />
        ) : null}
      </View>
      {feeds.map((f) => (
        <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Txt weight="medium">{f.name}</Txt>
            <Txt size="xs" color={f.lastError ? 'danger' : 'textMuted'} numberOfLines={1}>
              {f.lastError
                ? `${vi ? 'Lỗi' : 'Error'}: ${f.lastError}`
                : `${f.count ?? 0} ${vi ? 'sự kiện' : 'events'} · ${f.lastFetchedAt ? new Date(f.lastFetchedAt).toLocaleString(vi ? 'vi-VN' : 'en-GB') : ''}`}
            </Txt>
          </View>
          <Button
            size="sm"
            label={vi ? 'Hủy đăng ký' : 'Unsubscribe'}
            onPress={async () => {
              await removeFeed(f.id, true);
              refresh();
            }}
          />
        </View>
      ))}
    </View>
  );
}
