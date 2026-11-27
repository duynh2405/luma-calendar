import { describe, expect, it } from 'vitest';

import { lunarToSolar , lunarOfDayKey } from '../lunar/lunar';
import { dayKey } from '../time/days';
import { nextOccurrence, nthWeekdayOf, occurrenceDays, toRRule } from './recurrence';


const solar = (d: number, m: number, y: number, leap = false) => {
  const s = lunarToSolar(d, m, y, leap)!;
  return dayKey(s.year, s.month, s.day);
};

describe('daily / weekly', () => {
  it('daily with interval and count', () => {
    expect(occurrenceDays('2026-11-27', { freq: 'daily', interval: 2, count: 3 }, '2026-01-01', '2027-01-01')).toEqual([
      '2026-11-27',
      '2026-11-29',
      '2026-12-01',
    ]);
  });
  it('daily jumps straight to the window', () => {
    const r = occurrenceDays('2020-01-01', { freq: 'daily', interval: 1 }, '2026-11-27', '2026-11-28');
    expect(r).toEqual(['2026-11-27', '2026-11-28']);
  });
  it('weekly on several weekdays, until inclusive', () => {
    // Mon 23/11/2026, repeat Mon + Thu every week until 3/12
    const r = occurrenceDays('2026-11-23', { freq: 'weekly', interval: 1, byWeekday: [1, 4], until: '2026-12-03' }, '2026-11-01', '2027-01-01');
    expect(r).toEqual(['2026-11-23', '2026-11-26', '2026-11-30', '2026-12-03']);
  });
  it('weekly every 2 weeks including Sunday', () => {
    const r = occurrenceDays('2026-11-23', { freq: 'weekly', interval: 2, byWeekday: [0, 1] }, '2026-11-01', '2026-12-31');
    expect(r).toEqual(['2026-11-23', '2026-11-29', '2026-12-07', '2026-12-13', '2026-12-21', '2026-12-27']);
  });
  it('weekly window in the far future', () => {
    const r = occurrenceDays('2024-01-01', { freq: 'weekly', interval: 1 }, '2026-11-23', '2026-11-29');
    expect(r).toEqual(['2026-11-23']);
  });
});

describe('monthly / yearly', () => {
  it('day 31 skips shorter months (RFC 5545)', () => {
    const r = occurrenceDays('2026-01-31', { freq: 'monthly', interval: 1 }, '2026-01-01', '2026-06-30');
    expect(r).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
  });
  it('nth weekday and last weekday', () => {
    expect(nthWeekdayOf('2026-11-10')).toBe(2); // 2nd Tuesday
    expect(nthWeekdayOf('2026-11-27')).toBe(-1); // last Friday
    const second = occurrenceDays('2026-11-10', { freq: 'monthly', interval: 1, monthlyMode: 'nthWeekday' }, '2026-11-01', '2027-01-31');
    expect(second).toEqual(['2026-11-10', '2026-12-08', '2027-01-12']);
    const last = occurrenceDays('2026-11-27', { freq: 'monthly', interval: 1, monthlyMode: 'nthWeekday' }, '2026-11-01', '2027-01-31');
    expect(last).toEqual(['2026-11-27', '2026-12-25', '2027-01-29']);
  });
  it('yearly Feb 29 only in leap years', () => {
    const r = occurrenceDays('2024-02-29', { freq: 'yearly', interval: 1 }, '2024-01-01', '2032-12-31');
    expect(r).toEqual(['2024-02-29', '2028-02-29', '2032-02-29']);
  });
});

describe('lunar rules', () => {
  it('lunar yearly: a death anniversary on 10/3 âm', () => {
    const start = solar(10, 3, 2024);
    const r = occurrenceDays(start, { freq: 'lunarYearly', interval: 1 }, '2024-01-01', '2027-12-31');
    expect(r).toEqual([solar(10, 3, 2024), solar(10, 3, 2025), solar(10, 3, 2026), solar(10, 3, 2027)]);
    expect(r[1]).toBe('2025-04-07'); // Giỗ Tổ 2025
  });
  it('lunar yearly ignores the leap month by default (2025 has leap month 6)', () => {
    const start = solar(15, 6, 2024);
    const r = occurrenceDays(start, { freq: 'lunarYearly', interval: 1 }, '2025-01-01', '2025-12-31');
    expect(r).toEqual([solar(15, 6, 2025, false)]);
    const both = occurrenceDays(start, { freq: 'lunarYearly', interval: 1, leapMode: 'both' }, '2025-01-01', '2025-12-31');
    expect(both).toEqual([solar(15, 6, 2025, false), solar(15, 6, 2025, true)]);
  });
  it('a series that started in a leap month repeats in the regular month', () => {
    const start = solar(10, 6, 2025, true);
    const r = occurrenceDays(start, { freq: 'lunarYearly', interval: 1 }, '2025-01-01', '2026-12-31');
    expect(r).toEqual([solar(10, 6, 2026)]);
  });
  it('day 30 falls back to day 29 in short months', () => {
    // find a 30-day month to start from in 2026
    const start = solar(30, 1, 2026) ?? solar(30, 2, 2026);
    const r = occurrenceDays(start, { freq: 'lunarMonthly', interval: 1 }, start, '2027-03-01');
    expect(r.length).toBeGreaterThanOrEqual(12);
    for (const d of r) {
      const l = lunarOfDay(d);
      expect(l === 30 || l === 29).toBe(true);
    }
    // every lunar month appears exactly once
    expect(new Set(r).size).toBe(r.length);
  });
  it('lunar monthly mùng 1 & rằm include the leap month by default', () => {
    const start = solar(15, 1, 2025);
    const r = occurrenceDays(start, { freq: 'lunarMonthly', interval: 1 }, '2025-01-01', '2025-12-31');
    // Months 1–10 + leap month 6 fall in 2025 (rằm of months 11–12 are in 2026)
    expect(r).toContain(solar(15, 6, 2025, true));
    expect(r).toHaveLength(11);
  });
});

describe('helpers', () => {
  it('nextOccurrence', () => {
    expect(nextOccurrence('2026-11-23', { freq: 'weekly', interval: 1 }, '2026-11-23')).toBe('2026-11-30');
    expect(nextOccurrence('2026-11-23', { freq: 'weekly', interval: 1, count: 1 }, '2026-11-23')).toBeNull();
  });
  it('toRRule', () => {
    expect(toRRule({ freq: 'weekly', interval: 2, byWeekday: [1, 4], until: '2026-12-31' }, '2026-11-23')).toBe(
      'FREQ=WEEKLY;BYDAY=MO,TH;INTERVAL=2;UNTIL=20261231',
    );
    expect(toRRule({ freq: 'monthly', interval: 1, monthlyMode: 'nthWeekday' }, '2026-11-27')).toBe('FREQ=MONTHLY;BYDAY=-1FR');
    expect(toRRule({ freq: 'lunarYearly', interval: 1 }, '2026-11-27')).toBeNull();
  });
});
function lunarOfDay(d: string) {
  return lunarOfDayKey(d).day;
}
