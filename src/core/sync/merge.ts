/**
 * Three-way merge of one record, field by field.
 * base = last version both sides agreed on, local = this device now, remote = server now.
 * A field changed on one side only → that change wins. Changed on both sides to different
 * values → the side whose record was edited later (updatedAt) wins that field.
 */
type Rec = { updatedAt: string; [k: string]: unknown };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeRecords<T extends Rec>(base: T | null, local: T, remote: T): T {
  const localWins = local.updatedAt >= remote.updatedAt;
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...(base ? Object.keys(base) : [])]);
  for (const k of keys) {
    const b = base?.[k];
    const l = local[k];
    const r = remote[k];
    let v: unknown;
    if (same(l, r)) v = l;
    else if (base && same(l, b)) v = r;
    else if (base && same(r, b)) v = l;
    else v = localWins ? l : r;
    if (v !== undefined) out[k] = v;
  }
  out.updatedAt = localWins ? local.updatedAt : remote.updatedAt;
  return out as T;
}

/** True when two records carry the same data. */
export const sameRecord = (a: unknown, b: unknown) => same(a, b);
