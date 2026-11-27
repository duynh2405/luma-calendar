import { describe, expect, it } from 'vitest';

import {
  emptyMeta,
  type Kind,
  type PulledRow,
  type PushItem,
  type PushResult,
  type Rec,
  type Remote,
  runSync,
  type Snapshot,
  type SyncMeta,
} from './engine';

/** In-memory server that mirrors the push_records() SQL semantics (rev check, server_seq). */
class FakeServer implements Remote {
  rows = new Map<string, PulledRow>();
  seq = 0;
  online = true;
  async push(items: PushItem[]): Promise<PushResult> {
    if (!this.online) throw new Error('offline');
    const res: PushResult = { accepted: [], conflicts: [] };
    for (const it of items) {
      const key = `${it.kind}:${it.id}`;
      const cur = this.rows.get(key);
      if (!cur && it.base_rev !== 0) res.conflicts.push({ kind: it.kind, id: it.id, server: null });
      else if (cur && cur.rev !== it.base_rev)
        res.conflicts.push({ kind: it.kind, id: it.id, server: { rev: cur.rev, data: cur.data } });
      else {
        const rev = (cur?.rev ?? 0) + 1;
        this.rows.set(key, { kind: it.kind, id: it.id, rev, server_seq: ++this.seq, data: it.data });
        res.accepted.push({ kind: it.kind, id: it.id, rev });
      }
    }
    return res;
  }
  async pull(after: number, limit: number) {
    if (!this.online) throw new Error('offline');
    return [...this.rows.values()]
      .filter((r) => r.server_seq > after)
      .sort((a, b) => a.server_seq - b.server_seq)
      .slice(0, limit);
  }
}

class Device {
  data: Snapshot = { calendar: {}, event: {}, task: {} };
  meta: SyncMeta = emptyMeta();
  constructor(public server: FakeServer) {}
  put(kind: Kind, r: Rec) {
    this.data[kind][r.id] = structuredClone(r);
  }
  sync() {
    return runSync(
      {
        snapshot: () => this.data,
        apply: (ch) => {
          for (const k of Object.keys(ch) as Kind[]) for (const r of ch[k] ?? []) this.put(k, r);
        },
        remote: this.server,
      },
      this.meta,
    );
  }
}

const ev = (id: string, extra: Record<string, unknown> = {}, updatedAt = '2026-11-27T01:00:00.000Z'): Rec => ({
  id,
  title: 'T',
  location: '',
  updatedAt,
  ...extra,
});

describe('sync engine', () => {
  it('new records on one device appear on the other', async () => {
    const s = new FakeServer();
    const a = new Device(s);
    const b = new Device(s);
    a.put('event', ev('e1'));
    expect((await a.sync()).pushed).toBe(1);
    expect((await b.sync()).pulled).toBe(1);
    expect(b.data.event.e1.title).toBe('T');
  });

  it('a second sync with no changes does nothing', async () => {
    const s = new FakeServer();
    const a = new Device(s);
    a.put('event', ev('e1'));
    await a.sync();
    expect(await a.sync()).toEqual({ pushed: 0, pulled: 0, merged: 0 });
  });

  it('two devices edit different fields offline → both edits survive', async () => {
    const s = new FakeServer();
    const a = new Device(s);
    const b = new Device(s);
    a.put('event', ev('e1'));
    await a.sync();
    await b.sync();
    a.put('event', { ...a.data.event.e1, title: 'Từ A', updatedAt: '2026-11-27T02:00:00.000Z' });
    b.put('event', { ...b.data.event.e1, location: 'Từ B', updatedAt: '2026-11-27T03:00:00.000Z' });
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      expect(d.data.event.e1.title).toBe('Từ A');
      expect(d.data.event.e1.location).toBe('Từ B');
    }
  });

  it('same field edited on both: the later edit wins everywhere', async () => {
    const s = new FakeServer();
    const a = new Device(s);
    const b = new Device(s);
    a.put('event', ev('e1'));
    await a.sync();
    await b.sync();
    a.put('event', { ...a.data.event.e1, title: 'A', updatedAt: '2026-11-27T05:00:00.000Z' });
    b.put('event', { ...b.data.event.e1, title: 'B', updatedAt: '2026-11-27T04:00:00.000Z' });
    await b.sync();
    await a.sync();
    await b.sync();
    expect(a.data.event.e1.title).toBe('A');
    expect(b.data.event.e1.title).toBe('A');
  });

  it('work done offline is pushed once the network is back; a failure keeps local data', async () => {
    const s = new FakeServer();
    const a = new Device(s);
    a.put('event', ev('e1'));
    s.online = false;
    await expect(a.sync()).rejects.toThrow('offline');
    expect(a.data.event.e1).toBeDefined();
    s.online = true;
    expect((await a.sync()).pushed).toBe(1);
  });

  it('a soft delete syncs as a normal change', async () => {
    const s = new FakeServer();
    const a = new Device(s);
    const b = new Device(s);
    a.put('event', ev('e1'));
    await a.sync();
    await b.sync();
    a.put('event', { ...a.data.event.e1, deletedAt: '2026-11-27T06:00:00.000Z', updatedAt: '2026-11-27T06:00:00.000Z' });
    await a.sync();
    await b.sync();
    expect(b.data.event.e1.deletedAt).toBe('2026-11-27T06:00:00.000Z');
  });

  it('server lost a record we think is synced → it is sent again', async () => {
    const s = new FakeServer();
    const a = new Device(s);
    a.put('event', ev('e1'));
    await a.sync();
    s.rows.clear();
    a.put('event', { ...a.data.event.e1, title: 'Sửa', updatedAt: '2026-11-27T07:00:00.000Z' });
    await a.sync();
    expect(s.rows.get('event:e1')?.data.title).toBe('Sửa');
  });
});
