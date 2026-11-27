/**
 * Sync engine (pure: network and storage are injected, so it is unit-tested with a fake server).
 *
 * Model: each record has a server `rev`. We remember, per record, the last version both sides
 * agreed on (`base`). Local changes = records that differ from their base. Push sends changes with
 * the rev we saw; if the server moved on it answers "conflict" with its version, and we merge
 * field by field (see merge.ts) and push again.
 */
import { mergeRecords, sameRecord } from './merge';

export type Kind = 'calendar' | 'event' | 'task' | 'settings';
export interface Rec {
  id: string;
  updatedAt: string;
  [k: string]: unknown;
}
export type Snapshot = Record<Kind, Record<string, Rec>>;

export interface SyncMeta {
  cursor: number;
  recs: Record<string, { rev: number; base: Rec }>;
}
export const emptyMeta = (): SyncMeta => ({ cursor: 0, recs: {} });

export interface PushItem {
  kind: Kind;
  id: string;
  base_rev: number;
  data: Rec;
}
export interface PushResult {
  accepted: { kind: Kind; id: string; rev: number }[];
  conflicts: { kind: Kind; id: string; server: { rev: number; data: Rec } | null }[];
}
export interface PulledRow {
  kind: Kind;
  id: string;
  rev: number;
  server_seq: number;
  data: Rec;
}
export interface Remote {
  push(items: PushItem[]): Promise<PushResult>;
  pull(afterSeq: number, limit: number): Promise<PulledRow[]>;
}

export interface SyncDeps {
  snapshot(): Snapshot;
  /** Write records into the local store. */
  apply(changes: Partial<Record<Kind, Rec[]>>): void;
  remote: Remote;
}
export interface SyncReport {
  pushed: number;
  pulled: number;
  merged: number;
}

const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;
const KINDS: Kind[] = ['calendar', 'event', 'task', 'settings'];
const BATCH = 200;

export async function runSync(deps: SyncDeps, meta: SyncMeta): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, merged: 0 };

  const pull = async () => {
    for (;;) {
      const rows = await deps.remote.pull(meta.cursor, 500);
      if (!rows.length) return;
      const snap = deps.snapshot();
      const changes: Partial<Record<Kind, Rec[]>> = {};
      const add = (k: Kind, r: Rec) => (changes[k] ??= []).push(r);
      for (const row of rows) {
        const key = keyOf(row.kind, row.id);
        const local = snap[row.kind][row.id];
        const known = meta.recs[key];
        if (!local) {
          add(row.kind, row.data);
          report.pulled++;
        } else if (sameRecord(local, row.data)) {
          // already identical (our own echo)
        } else if (known && sameRecord(local, known.base)) {
          add(row.kind, row.data); // no local edits → take the server version
          report.pulled++;
        } else {
          add(row.kind, mergeRecords(known?.base ?? null, local, row.data));
          report.merged++;
        }
        meta.recs[key] = { rev: row.rev, base: row.data };
        meta.cursor = Math.max(meta.cursor, row.server_seq);
      }
      deps.apply(changes);
      if (rows.length < 500) return;
    }
  };

  const dirty = () => {
    const snap = deps.snapshot();
    const out: PushItem[] = [];
    for (const kind of KINDS)
      for (const r of Object.values(snap[kind])) {
        const known = meta.recs[keyOf(kind, r.id)];
        if (!known || !sameRecord(known.base, r)) out.push({ kind, id: r.id, base_rev: known?.rev ?? 0, data: r });
      }
    return out;
  };

  await pull();
  for (let round = 0; round < 4; round++) {
    const items = dirty();
    if (!items.length) break;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const res = await deps.remote.push(batch);
      const sent = new Map(batch.map((b) => [keyOf(b.kind, b.id), b.data]));
      for (const a of res.accepted) {
        meta.recs[keyOf(a.kind, a.id)] = { rev: a.rev, base: sent.get(keyOf(a.kind, a.id))! };
        report.pushed++;
      }
      const merged: Partial<Record<Kind, Rec[]>> = {};
      for (const c of res.conflicts) {
        const key = keyOf(c.kind, c.id);
        const local = sent.get(key)!;
        if (!c.server) {
          delete meta.recs[key]; // server lost it / never had it: send as new next round
          continue;
        }
        const base = meta.recs[key]?.base ?? null;
        const m = mergeRecords(base, local, c.server.data);
        (merged[c.kind] ??= []).push(m);
        meta.recs[key] = { rev: c.server.rev, base: c.server.data };
        report.merged++;
      }
      if (Object.keys(merged).length) deps.apply(merged);
    }
  }
  await pull();
  return report;
}
