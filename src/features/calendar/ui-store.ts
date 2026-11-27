/** Ephemeral UI state (not persisted except the last view). */
import { create } from 'zustand';

import type { EventDraft } from '@/core/model/draft';
import type { ID, ViewMode } from '@/core/model/types';
import { addDays, addMonths, type DayKey } from '@/core/time/days';

export type EditorState =
  | null
  | { mode: 'create'; draft: EventDraft; key: number }
  | { mode: 'edit'; id: ID; key: number };

type EditorInput = { mode: 'create'; draft: EventDraft } | { mode: 'edit'; id: ID } | null;
let editorSeq = 0;

export interface Toast {
  id: number;
  message: string;
  undo?: boolean;
}

interface UiState {
  view: ViewMode;
  cursor: DayKey | null;
  editor: EditorState;
  /** Live copy of the draft being created, drawn as a placeholder in the grid. */
  draftPreview: EventDraft | null;
  drawerOpen: boolean;
  calendarDialog: null | { mode: 'create' } | { mode: 'edit'; id: ID };
  converterOpen: boolean;
  toast: Toast | null;

  setView(v: ViewMode): void;
  setCursor(d: DayKey): void;
  step(dir: -1 | 1): void;
  openEditor(e: EditorInput): void;
  closeEditor(): void;
  setDraftPreview(d: EventDraft | null): void;
  setDrawer(open: boolean): void;
  setCalendarDialog(d: UiState['calendarDialog']): void;
  setConverter(open: boolean): void;
  showToast(message: string, undo?: boolean): void;
  hideToast(): void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set, get) => ({
  view: 'week',
  cursor: null,
  editor: null,
  draftPreview: null,
  drawerOpen: false,
  calendarDialog: null,
  converterOpen: false,
  toast: null,

  setView: (view) => set({ view }),
  setCursor: (cursor) => set({ cursor }),
  step(dir) {
    const { view, cursor } = get();
    if (!cursor) return;
    const n = view === 'day' ? 1 : view === '3day' ? 3 : view === 'week' ? 7 : view === 'agenda' ? 7 : 0;
    set({ cursor: view === 'month' ? addMonths(cursor, dir) : addDays(cursor, dir * n) });
  },
  openEditor: (e) =>
    set({
      editor: e ? { ...e, key: ++editorSeq } : null,
      draftPreview: e?.mode === 'create' ? e.draft : null,
    }),
  closeEditor: () => set({ editor: null, draftPreview: null }),
  setDraftPreview: (draftPreview) => set({ draftPreview }),
  setDrawer: (drawerOpen) => set({ drawerOpen }),
  setCalendarDialog: (calendarDialog) => set({ calendarDialog }),
  setConverter: (converterOpen) => set({ converterOpen }),
  showToast: (message, undo) => set({ toast: { id: ++toastSeq, message, undo } }),
  hideToast: () => set({ toast: null }),
}));
