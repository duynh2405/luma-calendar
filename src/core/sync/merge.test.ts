import { describe, expect, it } from 'vitest';

import { mergeRecords } from './merge';

const base = { id: 'e1', title: 'Họp', location: 'A', description: '', deletedAt: null as string | null, updatedAt: '2026-11-27T01:00:00.000Z' };

describe('mergeRecords', () => {
  it('keeps edits to different fields from both devices', () => {
    const local = { ...base, title: 'Họp khách', updatedAt: '2026-11-27T02:00:00.000Z' };
    const remote = { ...base, location: 'B', updatedAt: '2026-11-27T03:00:00.000Z' };
    const m = mergeRecords(base, local, remote);
    expect(m.title).toBe('Họp khách');
    expect(m.location).toBe('B');
    expect(m.updatedAt).toBe('2026-11-27T03:00:00.000Z');
  });

  it('same field on both sides: the later edit wins', () => {
    const local = { ...base, title: 'Local', updatedAt: '2026-11-27T05:00:00.000Z' };
    const remote = { ...base, title: 'Remote', updatedAt: '2026-11-27T04:00:00.000Z' };
    expect(mergeRecords(base, local, remote).title).toBe('Local');
    expect(mergeRecords(base, { ...local, updatedAt: '2026-11-27T03:00:00.000Z' }, remote).title).toBe('Remote');
  });

  it('a delete on one side survives an unrelated edit on the other', () => {
    const local = { ...base, deletedAt: '2026-11-27T02:00:00.000Z', updatedAt: '2026-11-27T02:00:00.000Z' };
    const remote = { ...base, location: 'B', updatedAt: '2026-11-27T03:00:00.000Z' };
    const m = mergeRecords(base, local, remote);
    expect(m.deletedAt).toBe('2026-11-27T02:00:00.000Z');
    expect(m.location).toBe('B');
  });

  it('without a base, both-changed fields fall back to the later record', () => {
    const local = { ...base, title: 'L', updatedAt: '2026-11-27T05:00:00.000Z' };
    const remote = { ...base, title: 'R', updatedAt: '2026-11-27T04:00:00.000Z' };
    expect(mergeRecords(null, local, remote).title).toBe('L');
  });

  it('compares arrays and objects by value', () => {
    const b = { ...base, reminders: [10] };
    const local = { ...b, reminders: [10, 60], updatedAt: '2026-11-27T02:00:00.000Z' };
    const remote = { ...b, title: 'X', updatedAt: '2026-11-27T03:00:00.000Z' };
    expect(mergeRecords(b, local, remote).reminders).toEqual([10, 60]);
  });
});
