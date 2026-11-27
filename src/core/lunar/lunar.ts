/**
 * Vietnamese lunar calendar (Âm lịch Việt Nam).
 *
 * Astronomical algorithm described by Hồ Ngọc Đức ("Âm lịch Việt Nam",
 * https://www.informatik.uni-leipzig.de/~duc/amlich/), based on Jean Meeus,
 * "Astronomical Algorithms". Re-implemented here in TypeScript.
 *
 * Rules:
 *  - A lunar month starts on the day (in the local time zone) of the new moon.
 *  - Month 11 is the month containing the winter solstice.
 *  - In a 13-month year, the leap month is the first month after month 11
 *    that contains no major solar term (trung khí).
 *
 * Vietnam has used UTC+7 for the lunar calendar since 1968. Before that it
 * followed UTC+8; results before 1968 may differ from historical calendars.
 * This module is pure TypeScript with no platform dependencies.
 */

export const VN_TIMEZONE_OFFSET = 7;

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  leap: boolean;
}

export interface SolarDate {
  day: number;
  month: number;
  year: number;
}

const INT = Math.floor;
const PI = Math.PI;

/** Julian day number of a Gregorian (or Julian, before 1582-10-15) date. */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

export function jdToDate(jd: number): SolarDate {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return { day, month, year };
}

/** Julian day (fractional, UTC) of the k-th new moon after 1900-01-01. */
function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  return jd1 + C1 - deltat;
}

/** Sun's apparent longitude (radians, 0..2π) at Julian day jdn (UTC). */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * INT(L / (PI * 2));
  return L;
}

/** Index 0..11 of the 30° sector the sun is in at local midnight starting dayNumber. */
function getSunLongitudeSector(dayNumber: number, tz: number): number {
  return INT((sunLongitude(dayNumber - 0.5 - tz / 24) / PI) * 6);
}

/** Exact sun longitude in degrees at local start of a day (used for solar terms). */
export function sunLongitudeDegrees(dayNumber: number, tz = VN_TIMEZONE_OFFSET): number {
  return (sunLongitude(dayNumber - 0.5 - tz / 24) * 180) / PI;
}

function getNewMoonDay(k: number, tz: number): number {
  return INT(newMoon(k) + 0.5 + tz / 24);
}

/** Julian day of the start of lunar month 11 of year yy (the month with the winter solstice). */
function getLunarMonth11(yy: number, tz: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, tz);
  const sunLong = getSunLongitudeSector(nm, tz);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, tz);
  }
  return nm;
}

/** Offset (in months after month 11 starting at a11) of the leap month. */
function getLeapMonthOffset(a11: number, tz: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = getSunLongitudeSector(getNewMoonDay(k + i, tz), tz);
  do {
    last = arc;
    i++;
    arc = getSunLongitudeSector(getNewMoonDay(k + i, tz), tz);
  } while (arc !== last && i < 14);
  return i - 1;
}

export function solarToLunar(dd: number, mm: number, yy: number, tz = VN_TIMEZONE_OFFSET): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  let k = INT((dayNumber - 2415021.076998695) / 29.530588853) + 1;
  let monthStart = getNewMoonDay(k, tz);
  // The mean-period estimate of k can be off by one; step back until the
  // month containing dayNumber is found (fixes rare "day 0" results, e.g. 2054-05-07).
  while (monthStart > dayNumber) {
    k--;
    monthStart = getNewMoonDay(k, tz);
  }
  let a11 = getLunarMonth11(yy, tz);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, tz);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, tz);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, tz);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}

/**
 * Converts a lunar date to a solar date. Returns null if the date does not exist
 * (e.g. a leap month that this year doesn't have, or day 30 of a 29-day month).
 */
export function lunarToSolar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  leap: boolean,
  tz = VN_TIMEZONE_OFFSET,
): SolarDate | null {
  const startJd = lunarMonthStartJd(lunarMonth, lunarYear, leap, tz);
  if (startJd === null) return null;
  if (lunarDay < 1 || lunarDay > 30) return null;
  if (lunarDay > lunarMonthLengthFromStart(startJd, tz)) return null;
  return jdToDate(startJd + lunarDay - 1);
}

/** Julian day of day 1 of the given lunar month, or null if that (leap) month doesn't exist. */
export function lunarMonthStartJd(
  lunarMonth: number,
  lunarYear: number,
  leap: boolean,
  tz = VN_TIMEZONE_OFFSET,
): number | null {
  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, tz);
    b11 = getLunarMonth11(lunarYear, tz);
  } else {
    a11 = getLunarMonth11(lunarYear, tz);
    b11 = getLunarMonth11(lunarYear + 1, tz);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, tz);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && lunarMonth !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) {
    return null;
  }
  return getNewMoonDay(k + off, tz);
}

function lunarMonthLengthFromStart(startJd: number, tz: number): number {
  const k = INT((startJd - 2415021.076998695) / 29.530588853 + 0.5);
  // Find the new moon after startJd.
  for (let i = k; i < k + 3; i++) {
    const nm = getNewMoonDay(i, tz);
    if (nm > startJd) return nm - startJd;
  }
  return 30;
}

/** Number of days (29 or 30) in a lunar month, or null if the month doesn't exist. */
export function lunarMonthLength(
  lunarMonth: number,
  lunarYear: number,
  leap: boolean,
  tz = VN_TIMEZONE_OFFSET,
): number | null {
  const start = lunarMonthStartJd(lunarMonth, lunarYear, leap, tz);
  if (start === null) return null;
  return lunarMonthLengthFromStart(start, tz);
}

/** The leap month number (1..12) of a lunar year, or 0 if none. */
export function leapMonthOfYear(lunarYear: number, tz = VN_TIMEZONE_OFFSET): number {
  for (let m = 1; m <= 12; m++) {
    if (lunarMonthStartJd(m, lunarYear, true, tz) !== null) return m;
  }
  return 0;
}

// --- Cached access by ISO day key, used by the UI (hundreds of cells per render) ---

const cache = new Map<string, LunarDate>();

/** Lunar date for an ISO day key "YYYY-MM-DD" (cached). */
export function lunarOfDayKey(dayKey: string): LunarDate {
  let v = cache.get(dayKey);
  if (!v) {
    const y = Number(dayKey.slice(0, 4));
    const m = Number(dayKey.slice(5, 7));
    const d = Number(dayKey.slice(8, 10));
    v = solarToLunar(d, m, y);
    if (cache.size > 5000) cache.clear();
    cache.set(dayKey, v);
  }
  return v;
}
