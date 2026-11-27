/// <reference types="node" />
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { canChiDay, canChiMonth, canChiYear } from './canchi';
import {
  jdFromDate,
  jdToDate,
  leapMonthOfYear,
  lunarMonthLength,
  lunarToSolar,
  solarToLunar,
} from './lunar';

const require = createRequire(import.meta.url);

/** Tết Nguyên Đán (1/1 âm) dates in Vietnam, from published Vietnamese calendars. */
const TET_VN: [number, number, number][] = [
  // [year, month, day] (solar)
  [1968, 1, 29], // North Vietnam adopted UTC+7: Tết on 29/1 (South, UTC+8, celebrated 30/1)
  [1985, 1, 21], // Famous case: China's New Year was 20/2/1985
  [2000, 2, 5],
  [2007, 2, 17], // China: 18/2/2007
  [2010, 2, 14],
  [2015, 2, 19],
  [2020, 1, 25],
  [2021, 2, 12],
  [2022, 2, 1],
  [2023, 1, 22],
  [2024, 2, 10],
  [2025, 1, 29],
  [2026, 2, 17],
  [2027, 2, 6],
  [2028, 1, 26],
  [2030, 2, 2], // China: 3/2/2030
];

describe('regressions', () => {
  it('no "day 0" when the new-moon estimate is off by one (2054-05-07, 2062-04-09)', () => {
    // Both are the last day (30) of the previous lunar month; the next day is mùng 1.
    expect(solarToLunar(7, 5, 2054)).toMatchObject({ day: 30, month: 3 });
    expect(solarToLunar(8, 5, 2054)).toMatchObject({ day: 1, month: 4 });
    expect(solarToLunar(9, 4, 2062)).toMatchObject({ day: 30, month: 2 });
  });
});

/** Leap months (tháng nhuận) of lunar years in Vietnam. */
const LEAP_VN: [number, number][] = [
  [2001, 4],
  [2004, 2],
  [2006, 7],
  [2009, 5],
  [2012, 4],
  [2014, 9],
  [2017, 6],
  [2020, 4],
  [2023, 2],
  [2025, 6],
  [2028, 5],
];

describe('Julian day', () => {
  it('round-trips', () => {
    for (const [y, m, d] of [
      [2000, 1, 1],
      [1582, 10, 15],
      [1900, 2, 28],
      [2100, 12, 31],
    ]) {
      expect(jdToDate(jdFromDate(d, m, y))).toEqual({ day: d, month: m, year: y });
    }
  });
  it('known value: 2000-01-01 is JD 2451545', () => {
    expect(jdFromDate(1, 1, 2000)).toBe(2451545);
  });
});

describe('Tết Nguyên Đán (Vietnam, UTC+7)', () => {
  for (const [y, m, d] of TET_VN) {
    it(`Tết ${y} is ${d}/${m}/${y}`, () => {
      expect(solarToLunar(d, m, y)).toEqual({ day: 1, month: 1, year: y, leap: false });
      expect(lunarToSolar(1, 1, y, false)).toEqual({ day: d, month: m, year: y });
    });
  }

  it('1985 differs from the Chinese calendar (UTC+8)', () => {
    // With UTC+8 the new moon of 21/1/1985 falls on a different day, shifting the year.
    expect(lunarToSolar(1, 1, 1985, false, 8)).toEqual({ day: 20, month: 2, year: 1985 });
  });

  it('2007 differs from the Chinese calendar (UTC+8)', () => {
    expect(lunarToSolar(1, 1, 2007, false, 8)).toEqual({ day: 18, month: 2, year: 2007 });
  });
});

describe('leap months', () => {
  for (const [y, m] of LEAP_VN) {
    it(`${y} has leap month ${m}`, () => {
      expect(leapMonthOfYear(y)).toBe(m);
    });
  }
  it('2024 and 2026 have no leap month', () => {
    expect(leapMonthOfYear(2024)).toBe(0);
    expect(leapMonthOfYear(2026)).toBe(0);
  });
  it('converts dates inside a leap month (2025: tháng 6 nhuận)', () => {
    const start = lunarToSolar(1, 6, 2025, true);
    expect(start).not.toBeNull();
    const back = solarToLunar(start!.day, start!.month, start!.year);
    expect(back).toEqual({ day: 1, month: 6, year: 2025, leap: true });
    // Regular month 6 comes before the leap month 6
    const regular = lunarToSolar(1, 6, 2025, false)!;
    expect(jdFromDate(regular.day, regular.month, regular.year)).toBeLessThan(
      jdFromDate(start!.day, start!.month, start!.year),
    );
  });
  it('returns null for a leap month the year does not have', () => {
    expect(lunarToSolar(1, 3, 2025, true)).toBeNull();
    expect(lunarToSolar(1, 6, 2024, true)).toBeNull();
  });
});

describe('known festival dates', () => {
  it.each([
    ['Trung Thu 2024', 15, 8, 2024, { day: 17, month: 9, year: 2024 }],
    ['Trung Thu 2025', 15, 8, 2025, { day: 6, month: 10, year: 2025 }],
    ['Giỗ Tổ 2024', 10, 3, 2024, { day: 18, month: 4, year: 2024 }],
    ['Giỗ Tổ 2025', 10, 3, 2025, { day: 7, month: 4, year: 2025 }],
    ['Rằm tháng Giêng 2025', 15, 1, 2025, { day: 12, month: 2, year: 2025 }],
  ])('%s', (_name, d, m, y, expected) => {
    expect(lunarToSolar(d, m, y, false)).toEqual(expected);
  });
});

describe('month lengths', () => {
  it('every month has 29 or 30 days', () => {
    for (let y = 1968; y <= 2100; y++) {
      for (let m = 1; m <= 12; m++) {
        const len = lunarMonthLength(m, y, false);
        expect(len === 29 || len === 30).toBe(true);
      }
    }
  });
  it('day 30 of a 29-day month does not exist', () => {
    for (let m = 1; m <= 12; m++) {
      if (lunarMonthLength(m, 2026, false) === 29) {
        expect(lunarToSolar(30, m, 2026, false)).toBeNull();
        return;
      }
    }
    throw new Error('expected at least one 29-day month in 2026');
  });
});

describe('round trip solar → lunar → solar, every day 1900–2100', () => {
  it('is consistent', () => {
    let failures = 0;
    for (let jd = jdFromDate(1, 1, 1900); jd <= jdFromDate(31, 12, 2100); jd++) {
      const s = jdToDate(jd);
      const l = solarToLunar(s.day, s.month, s.year);
      const back = lunarToSolar(l.day, l.month, l.year, l.leap);
      if (!back || back.day !== s.day || back.month !== s.month || back.year !== s.year) failures++;
      if (l.day < 1 || l.day > 30) failures++;
    }
    expect(failures).toBe(0);
  });
});

describe('cross-check with the Chinese calendar (lunar-javascript, UTC+8)', () => {
  it('agrees on the vast majority of days 1968–2100 and differs in the known years', () => {
    const { Solar } = require('lunar-javascript');
    let diffDays = 0;
    let total = 0;
    const diffYears = new Set<number>();
    for (let jd = jdFromDate(1, 1, 1968); jd <= jdFromDate(31, 12, 2100); jd++) {
      const s = jdToDate(jd);
      const vn = solarToLunar(s.day, s.month, s.year);
      const cn = Solar.fromYmd(s.year, s.month, s.day).getLunar();
      const cnMonth = cn.getMonth();
      const same =
        vn.day === cn.getDay() &&
        vn.month === Math.abs(cnMonth) &&
        vn.leap === cnMonth < 0 &&
        vn.year === cn.getYear();
      total++;
      if (!same) {
        diffDays++;
        diffYears.add(s.year);
      }
    }
    // Differences exist (that's the point of using UTC+7) but must be rare.
    expect(diffDays).toBeGreaterThan(0);
    // Typical pattern: the new moon falls just before midnight UTC+8, so Vietnam
    // starts the month one day earlier (≈30 differing days per affected month).
    expect(diffDays / total).toBeLessThan(0.05);
    expect(diffYears.has(1985)).toBe(true);
    expect(diffYears.has(2007)).toBe(true);
  });
});

describe('Can Chi', () => {
  it('years', () => {
    expect(canChiYear(2024)).toBe('Giáp Thìn');
    expect(canChiYear(2025)).toBe('Ất Tỵ');
    expect(canChiYear(2026)).toBe('Bính Ngọ');
    expect(canChiYear(1968)).toBe('Mậu Thân');
  });
  it('months', () => {
    expect(canChiMonth(1, 2024)).toBe('Bính Dần');
    expect(canChiMonth(1, 2026)).toBe('Canh Dần');
  });
  it('days', () => {
    // Mùng 1 Tết Giáp Thìn (10/2/2024) was a Giáp Thìn day.
    expect(canChiDay(10, 2, 2024)).toBe('Giáp Thìn');
  });
});
