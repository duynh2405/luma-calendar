import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { listBackups, readBackup, runAutoBackup } from '@/data/autobackup';
import { saveTextFile } from '@/data/file-io';
import { useData } from '@/data/store';
import { useLocale } from '@/i18n';
import { Button, Txt } from '@/ui/primitives';

import { useUi } from '../calendar/ui-store';

/** Automatic daily backups (last 7): restore (merge by updatedAt) or download. */
export function BackupPanel() {
  const vi = useLocale() === 'vi';
  const [items, setItems] = useState<{ day: string; bytes: number }[]>([]);
  const refresh = useCallback(() => void listBackups().then(setItems), []);
  useEffect(() => {
    void runAutoBackup().then(refresh);
  }, [refresh]);

  async function restore(day: string) {
    const text = await readBackup(day);
    if (!text) return;
    try {
      const st = useData.getState().importBackup(text);
      useUi.getState().showToast(vi ? `Đã khôi phục: thêm ${st.added}, cập nhật ${st.updated}` : `Restored: ${st.added} added, ${st.updated} updated`, true);
    } catch {
      useUi.getState().showToast(vi ? 'Không khôi phục được' : 'Restore failed');
    }
  }
  async function download(day: string) {
    const text = await readBackup(day);
    if (text) await saveTextFile(`luma-calendar-${day}.json`, text);
  }

  return (
    <View style={{ gap: 8 }}>
      <Txt size="sm" color="textMuted">
        {vi
          ? 'Mỗi ngày app tự lưu một bản sao trên máy này (giữ 7 bản gần nhất). Khôi phục chỉ thêm/cập nhật bản ghi mới hơn, không ghi đè thay đổi mới.'
          : 'A copy is saved on this device each day (last 7 kept). Restoring only adds or updates newer records.'}
      </Txt>
      {items.length === 0 ? (
        <Txt size="sm" color="textFaint">
          {vi ? 'Chưa có bản sao lưu nào.' : 'No backups yet.'}
        </Txt>
      ) : (
        items.map((b) => (
          <View key={b.day} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt style={{ flex: 1 }}>
              {b.day} · {Math.max(1, Math.round(b.bytes / 1024))} KB
            </Txt>
            <Button size="sm" label={vi ? 'Khôi phục' : 'Restore'} onPress={() => restore(b.day)} />
            <Button size="sm" label={vi ? 'Tải về' : 'Download'} onPress={() => download(b.day)} />
          </View>
        ))
      )}
    </View>
  );
}
