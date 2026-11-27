/** UI-level actions that combine data mutations with feedback (toast + undo). */
import type { StringKey } from '@/i18n/strings';
import { translate } from '@/i18n';
import { useData } from '@/data/store';

import { useUi } from './ui-store';

function label(key: string): string {
  const locale = useData.getState().settings.locale;
  return translate(locale, `undo.${key}` as StringKey);
}

/** Show an undo toast for the latest committed change. */
export function notifyChange(undoKey: string) {
  useUi.getState().showToast(label(undoKey), true);
}

export function performUndo() {
  const undone = useData.getState().undo();
  const locale = useData.getState().settings.locale;
  if (undone) useUi.getState().showToast(translate(locale, 'undone', { label: label(undone) }), false);
}

/** Run a data mutation; report validation/storage errors as a toast instead of crashing. */
export function safely<T>(fn: () => T, undoKey?: string): T | undefined {
  try {
    const r = fn();
    if (undoKey) notifyChange(undoKey);
    return r;
  } catch (err) {
    const locale = useData.getState().settings.locale;
    const code = err instanceof Error ? err.message.split(',')[0] : '';
    const msg = translate(locale, `err.${code}` as StringKey);
    useUi.getState().showToast(msg.startsWith('err.') ? String(err) : msg, false);
    return undefined;
  }
}
