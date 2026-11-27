import { History } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { CalendarEvent } from '@/core/model/types';
import { useData } from '@/data/store';
import { useLocale } from '@/i18n';
import { fetchVersions, useSync, type VersionRow } from '@/sync/service';
import { Button, Txt } from '@/ui/primitives';

import { useUi } from './ui-store';

/** Version history of a synced event: list server versions and restore one (as a new edit, undoable). */
export function VersionHistory({ event }: { event: CalendarEvent }) {
  const vi = useLocale() === 'vi';
  const status = useSync((s) => s.status);
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (status === 'off' || status === 'signedOut') return null;

  async function load() {
    setBusy(true);
    try {
      setRows(await fetchVersions('event', event.id));
    } catch (e) {
      useUi.getState().showToast(String(e));
    } finally {
      setBusy(false);
    }
  }

  function restore(r: VersionRow) {
    const { id, createdAt, updatedAt, deletedAt, ...rest } = r.data as Record<string, unknown>;
    useData.getState().updateEvent(event.id, rest as never, 'event-updated');
    useUi.getState().showToast(vi ? `Đã khôi phục bản ${r.rev}` : `Restored version ${r.rev}`, true);
  }

  return (
    <View style={{ gap: 6 }}>
      <Button size="sm" icon={History} label={vi ? 'Lịch sử phiên bản' : 'Version history'} onPress={load} disabled={busy} />
      {rows?.length === 0 ? (
        <Txt size="sm" color="textFaint">
          {vi ? 'Chưa có phiên bản nào trên máy chủ (cần đồng bộ trước).' : 'No saved versions yet (sync first).'}
        </Txt>
      ) : null}
      {rows?.map((r) => (
        <View key={r.rev} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt size="sm" color="textMuted" style={{ width: 120 }}>
            {new Date(r.savedAt).toLocaleString(vi ? 'vi-VN' : 'en-GB')}
          </Txt>
          <Txt size="sm" numberOfLines={1} style={{ flex: 1 }}>
            {String(r.data.title ?? '')}
          </Txt>
          <Button size="sm" label={vi ? 'Khôi phục' : 'Restore'} onPress={() => restore(r)} />
        </View>
      ))}
    </View>
  );
}
