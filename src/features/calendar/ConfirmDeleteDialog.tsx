/** "Delete <title>?" confirmation shown when the owner clicks the ✕ on a job. */
import { useData } from '@/data/store';
import { useT } from '@/i18n';
import { Button, Dialog, Txt } from '@/ui/primitives';

import { deleteInstance } from './actions';
import { useUi } from './ui-store';

export function ConfirmDeleteDialog() {
  const T = useT();
  const vi = useData((s) => s.settings.locale) === 'vi';
  const item = useUi((s) => s.confirmDelete);
  if (!item) return null;
  const close = () => useUi.getState().setConfirmDelete(null);
  return (
    <Dialog
      visible
      onClose={close}
      title={vi ? (item.task ? 'Xóa công việc?' : 'Xóa sự kiện?') : item.task ? 'Delete task?' : 'Delete event?'}
      width={380}
      footer={
        <>
          <Button label={T('cancel')} onPress={close} />
          <Button
            variant="danger"
            label={T('delete')}
            onPress={() => {
              close();
              deleteInstance(item);
            }}
          />
        </>
      }
    >
      <Txt weight="medium" numberOfLines={2}>
        {item.title}
      </Txt>
      <Txt size="sm" color="textMuted">
        {vi ? 'Sẽ được chuyển vào Thùng rác, bạn có thể khôi phục hoặc bấm Hoàn tác.' : 'It moves to the Trash; you can restore it or press Undo.'}
      </Txt>
    </Dialog>
  );
}
