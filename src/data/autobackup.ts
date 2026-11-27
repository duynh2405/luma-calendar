/**
 * Automatic local backups: at most one snapshot per day, the last 7 are kept, stored next to the data
 * (IndexedDB on web, SQLite on Android/iOS) under keys `backup:YYYY-MM-DD`. They are ignored by the
 * data loader. Restoring merges by updatedAt like a JSON import, so it never overwrites newer edits.
 */
import { useData } from './store';
import { recordStorage } from './storage';

const KEEP = 7;
const PREFIX = 'backup:';

export async function listBackups(): Promise<{ day: string; bytes: number }[]> {
  const all = await recordStorage.loadAll();
  return Object.keys(all)
    .filter((k) => k.startsWith(PREFIX))
    .map((k) => ({ day: k.slice(PREFIX.length), bytes: String(all[k]).length }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

export async function readBackup(day: string): Promise<string | null> {
  const all = await recordStorage.loadAll();
  const v = all[PREFIX + day];
  return typeof v === 'string' ? v : null;
}

/** Take today's snapshot if there is none yet, then prune old ones. Returns true if one was written. */
export async function runAutoBackup(now = new Date()): Promise<boolean> {
  const s = useData.getState();
  if (!s.loaded) return false;
  const day = now.toISOString().slice(0, 10);
  const have = await listBackups();
  let wrote = false;
  if (!have.some((b) => b.day === day) && (Object.keys(s.events).length || Object.keys(s.tasks).length)) {
    await recordStorage.putMany([[PREFIX + day, JSON.stringify(s.exportBackup())]]);
    wrote = true;
  }
  const days = [...new Set([...have.map((b) => b.day), ...(wrote ? [day] : [])])].sort().reverse();
  const old = days.slice(KEEP).map((d) => PREFIX + d);
  if (old.length) await recordStorage.removeMany(old);
  return wrote;
}
