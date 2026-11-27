/** Ephemeral UI state (not persisted). */
import { create } from 'zustand';

import type { EventDraft } from '@/core/model/draft';
import type { ID, ViewMode } from '@/core/model/types';
import type { EventContent } from '@/core/recurrence/edit';
import type { EventInstance } from '@/core/recurrence/expand';
import { addDays, addMonths, type DayKey } from '@/core/time/days';

import type { DisplayEvent } from './actions';

export type EditorState =
  | null
  | { mode: 'create'; draft: EventDraft; key: number }
  /** `instance` is the occurrence that was opened (for recurring series). */
  | { mode: 'edit'; id: ID; instance: EventInstance | null; key: number };

type EditorInput = { mode: 'create'; draft: EventDraft } | { mode: 'edit'; id: ID; instance?: EventInstance | null } | null;
let editorSeq = 0;

export interface Toast {
  id: number;
  message: string;
  undo?: boolean;
}

/** A change to one occurrence of a recurring series, waiting for "this / following / all". */
export type ScopePrompt =
  | { kind: 'edit'; instance: EventInstance; content: EventContent; label: string; onDone?: () => void }
  | { kind: 'delete'; instance: EventInstance; onDone?: () => void };

interface UiState {
  view: ViewMode;
  cursor: DayKey | null;
  editor: EditorState;
  /** Task detail panel (shares the side panel with the event editor). */
  taskPanel: null | { id: ID; key: number };
  /** Live copy of the draft being created, drawn as a placeholder in the grid. */
  draftPreview: EventDraft | null;
  drawerOpen: boolean;
  calendarDialog: null | { mode: 'create' } | { mode: 'edit'; id: ID };
  converterOpen: boolean;
  searchOpen: boolean;
  scopePrompt: ScopePrompt | null;
  /** An event/task waiting for the owner to confirm its deletion. */
  confirmDelete: DisplayEvent | null;
  /** Incremented to focus the quick-add bar (FAB on Today / Tasks). */
  quickAddNonce: number;
  toast: Toast | null;

  setView(v: ViewMode): void;
  setCursor(d: DayKey): void;
  step(dir: -1 | 1): void;
  openEditor(e: EditorInput): void;
  closeEditor(): void;
  openTask(id: ID | null): void;
  setDraftPreview(d: EventDraft | null): void;
  setDrawer(open: boolean): void;
  setCalendarDialog(d: UiState['calendarDialog']): void;
  setConverter(open: boolean): void;
  setSearch(open: boolean): void;
  setScopePrompt(p: ScopePrompt | null): void;
  setConfirmDelete(i: DisplayEvent | null): void;
  focusQuickAdd(): void;
  showToast(message: string, undo?: boolean): void;
  hideToast(): void;
}

let toastSeq = 0;

export const useUi = create<UiState>((set, get) => ({
  view: 'week',
  cursor: null,
  editor: null,
  taskPanel: null,
  draftPreview: null,
  drawerOpen: false,
  calendarDialog: null,
  converterOpen: false,
  searchOpen: false,
  scopePrompt: null,
  confirmDelete: null,
  quickAddNonce: 0,
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
      editor: e ? (e.mode === 'edit' ? { ...e, instance: e.instance ?? null, key: ++editorSeq } : { ...e, key: ++editorSeq }) : null,
      draftPreview: e?.mode === 'create' ? e.draft : null,
      taskPanel: null,
    }),
  closeEditor: () => set({ editor: null, draftPreview: null }),
  openTask: (id) => set({ taskPanel: id ? { id, key: ++editorSeq } : null, ...(id ? { editor: null, draftPreview: null } : {}) }),
  setDraftPreview: (draftPreview) => set({ draftPreview }),
  setDrawer: (drawerOpen) => set({ drawerOpen }),
  setCalendarDialog: (calendarDialog) => set({ calendarDialog }),
  setConverter: (converterOpen) => set({ converterOpen }),
  setSearch: (searchOpen) => set({ searchOpen }),
  setScopePrompt: (scopePrompt) => set({ scopePrompt }),
  setConfirmDelete: (confirmDelete) => set({ confirmDelete }),
  focusQuickAdd: () => set({ quickAddNonce: get().quickAddNonce + 1 }),
  showToast: (message, undo) => set({ toast: { id: ++toastSeq, message, undo } }),
  hideToast: () => set({ toast: null }),
}));
