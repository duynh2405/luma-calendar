/**
 * Sync service: account (email one-time code), automatic and manual sync, status for the UI.
 * Local data is always the source the UI reads; sync only reconciles it with the server in the background.
 */
import { create } from 'zustand';

import { emptyMeta, type Kind, type Rec, runSync, type Snapshot, type SyncMeta } from '@/core/sync/engine';
import { SYNCED_SETTINGS, useData } from '@/data/store';
import { recordStorage } from '@/data/storage';

import { remote, supabase, syncConfigured } from './supabase';

const META_KEY = 'sync:meta';

export type SyncStatus = 'off' | 'signedOut' | 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  email: string | null;
  lastSyncAt: string | null;
  error: string | null;
  configured: boolean;
  start(): Promise<void>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
}

let meta: SyncMeta & { userId?: string } = emptyMeta();
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;

function snapshot(): Snapshot {
  const s = useData.getState();
  const settings: Record<string, Rec> = {};
  if (s.settings.updatedAt) {
    const rec: Rec = { id: 'main', updatedAt: s.settings.updatedAt, deletedAt: null };
    for (const k of SYNCED_SETTINGS) rec[k] = s.settings[k];
    settings.main = rec;
  }
  return { calendar: s.calendars, event: s.events, task: s.tasks, settings } as unknown as Snapshot;
}

function apply(ch: Partial<Record<Kind, Rec[]>>) {
  useData.getState().applyRemote({
    calendars: ch.calendar as never,
    events: ch.event as never,
    tasks: ch.task as never,
    settings: ch.settings?.[ch.settings.length - 1],
  });
}

async function loadMeta() {
  const all = await recordStorage.loadAll();
  meta = (all[META_KEY] as typeof meta | undefined) ?? emptyMeta();
}

const friendly = (err: unknown) => {
  const m = err instanceof Error ? err.message : String(err);
  return /fetch|network|offline/i.test(m) ? 'offline' : m;
};

export const useSync = create<SyncState>((set, get) => {
  async function run() {
    if (!supabase || get().status === 'signedOut' || get().status === 'off') return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    set({ status: 'syncing', error: null });
    try {
      await runSync({ snapshot, apply, remote }, meta);
      await recordStorage.putMany([[META_KEY, meta]]);
      set({ status: 'idle', lastSyncAt: new Date().toISOString() });
    } catch (err) {
      set({ status: 'error', error: friendly(err) });
    } finally {
      running = false;
      if (again) {
        again = false;
        schedule(500);
      }
    }
  }

  function schedule(ms: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), ms);
  }

  /** Bind to a signed-in session; a different account starts with a fresh sync state. */
  async function bind(userId: string, email: string | null) {
    await loadMeta();
    if (meta.userId !== userId) meta = { ...emptyMeta(), userId };
    set({ status: 'idle', email, error: null });
    void run();
  }

  return {
    status: syncConfigured ? 'signedOut' : 'off',
    email: null,
    lastSyncAt: null,
    error: null,
    configured: syncConfigured,

    async start() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) await bind(data.session.user.id, data.session.user.email ?? null);

      // Sync soon after local edits, when the tab regains focus, when the network returns, and periodically.
      useData.subscribe((s, prev) => {
        if (s.events !== prev.events || s.tasks !== prev.tasks || s.calendars !== prev.calendars || s.settings !== prev.settings) schedule(3000);
      });
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('online', () => schedule(500));
        window.addEventListener('focus', () => schedule(1000));
      }
      setInterval(() => schedule(0), 60_000);
    },

    async sendCode(email) {
      const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw new Error(error.message);
    },

    async verifyCode(email, code) {
      const { data, error } = await supabase!.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error || !data.user) throw new Error(error?.message ?? 'verify-failed');
      await bind(data.user.id, data.user.email ?? email);
    },

    async signOut() {
      await supabase?.auth.signOut();
      set({ status: 'signedOut', email: null });
    },

    async syncNow() {
      await run();
    },
  };
});

export interface VersionRow {
  rev: number;
  savedAt: string;
  data: Rec;
}

/** Saved versions of one record from the server (newest first). Needs a signed-in session. */
export async function fetchVersions(kind: Kind, id: string): Promise<VersionRow[]> {
  if (!supabase || useSync.getState().status === 'signedOut' || useSync.getState().status === 'off') return [];
  const { data, error } = await supabase
    .from('record_versions')
    .select('rev,saved_at,data')
    .eq('kind', kind)
    .eq('id', id)
    .order('rev', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ rev: r.rev as number, savedAt: r.saved_at as string, data: r.data as Rec }));
}
