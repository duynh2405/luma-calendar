import { describe, expect, it } from 'vitest';

import { addDays, addMonths, diffDays, monthGridDays, startOfWeek, weekday } from './days';
import { formatMinutes, instantToWall, wallToInstant, zoneOffsetMinutes } from './zone';

describe('day keys', () => {
  it('adds days across month/year/leap boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('diffDays', () => {
    expect(diffDays('2026-11-27', '2026-11-01')).toBe(26);
    expect(diffDays('2026-01-01', '2025-01-01')).toBe(365);
  });
  it('weekday and week start', () => {
    expect(weekday('2026-11-27')).toBe(5); // Friday
    expect(startOfWeek('2026-11-27', 1)).toBe('2026-11-23'); // Monday
    expect(startOfWeek('2026-11-23', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-29', 1)).toBe('2026-11-23'); // Sunday belongs to the Monday week
    expect(startOfWeek('2026-11-27', 0)).toBe('2026-11-22'); // Sunday
  });
  it('addMonths clamps the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });
  it('month grid has 42 days starting on the week start', () => {
    const g = monthGridDays('2026-11-15', 1);
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-10-26');
    expect(weekday(g[0])).toBe(1);
  });
});

describe('time zones', () => {
  it('Asia/Ho_Chi_Minh is UTC+7', () => {
    expect(zoneOffsetMinutes(Date.parse('2026-06-01T00:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe(420);
  });
  it('instant ↔ wall time round-trip', () => {
    const iso = wallToInstant('2026-11-27', 7 * 60 + 30, 'Asia/Ho_Chi_Minh');
    expect(iso).toBe('2026-11-27T00:30:00.000Z');
    expect(instantToWall(iso, 'Asia/Ho_Chi_Minh')).toEqual({ day: '2026-11-27', minutes: 450 });
  });
  it('crosses the date line correctly', () => {
    expect(instantToWall('2026-11-27T20:00:00Z', 'Asia/Ho_Chi_Minh')).toEqual({ day: '2026-11-28', minutes: 180 });
  });
  it('handles DST zones', () => {
    // 2026-03-29 Europe/Berlin switches to CEST at 02:00 → 03:00
    expect(wallToInstant('2026-03-29', 12 * 60, 'Europe/Berlin')).toBe('2026-03-29T10:00:00.000Z');
    expect(wallToInstant('2026-01-15', 12 * 60, 'Europe/Berlin')).toBe('2026-01-15T11:00:00.000Z');
  });
  it('formats minutes', () => {
    expect(formatMinutes(7 * 60 + 5, '24h')).toBe('07:05');
    expect(formatMinutes(0, '12h')).toBe('12:00 AM');
    expect(formatMinutes(13 * 60 + 30, '12h')).toBe('1:30 PM');
  });
});
