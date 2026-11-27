import type { LunarDate } from './lunar';

export interface Holiday {
  key: string;
  name: { vi: string; en: string };
  /** Official public holiday (ngày nghỉ lễ chính thức). */
  official?: boolean;
}

interface SolarHolidayRule extends Holiday {
  type: 'solar';
  month: number;
  day: number;
}

interface LunarHolidayRule extends Holiday {
  type: 'lunar';
  month: number;
  day: number;
}

/**
 * Vietnamese traditional and national holidays. Display-only for now (M1);
 * becomes a read-only "holiday calendar" with per-item toggles later.
 */
export const HOLIDAY_RULES: (SolarHolidayRule | LunarHolidayRule)[] = [
  { type: 'solar', month: 1, day: 1, key: 'new-year', official: true, name: { vi: 'Tết Dương lịch', en: "New Year's Day" } },
  { type: 'solar', month: 2, day: 3, key: 'cpv', name: { vi: 'Ngày thành lập Đảng', en: 'Communist Party Founding Day' } },
  { type: 'solar', month: 2, day: 14, key: 'valentine', name: { vi: 'Lễ Tình nhân', en: "Valentine's Day" } },
  { type: 'solar', month: 3, day: 8, key: 'women-intl', name: { vi: 'Quốc tế Phụ nữ', en: "International Women's Day" } },
  { type: 'solar', month: 4, day: 30, key: 'reunification', official: true, name: { vi: 'Giải phóng miền Nam', en: 'Reunification Day' } },
  { type: 'solar', month: 5, day: 1, key: 'labour', official: true, name: { vi: 'Quốc tế Lao động', en: 'Labour Day' } },
  { type: 'solar', month: 6, day: 1, key: 'children', name: { vi: 'Quốc tế Thiếu nhi', en: "Children's Day" } },
  { type: 'solar', month: 9, day: 2, key: 'national', official: true, name: { vi: 'Quốc khánh', en: 'National Day' } },
  { type: 'solar', month: 10, day: 20, key: 'women-vn', name: { vi: 'Ngày Phụ nữ Việt Nam', en: "Vietnamese Women's Day" } },
  { type: 'solar', month: 11, day: 20, key: 'teachers', name: { vi: 'Ngày Nhà giáo Việt Nam', en: "Teachers' Day" } },
  { type: 'solar', month: 12, day: 24, key: 'christmas-eve', name: { vi: 'Đêm Giáng sinh', en: 'Christmas Eve' } },
  { type: 'solar', month: 12, day: 25, key: 'christmas', name: { vi: 'Giáng sinh', en: 'Christmas' } },

  { type: 'lunar', month: 1, day: 1, key: 'tet-1', official: true, name: { vi: 'Tết Nguyên Đán', en: 'Lunar New Year' } },
  { type: 'lunar', month: 1, day: 2, key: 'tet-2', official: true, name: { vi: 'Mùng 2 Tết', en: 'Lunar New Year (2nd day)' } },
  { type: 'lunar', month: 1, day: 3, key: 'tet-3', official: true, name: { vi: 'Mùng 3 Tết', en: 'Lunar New Year (3rd day)' } },
  { type: 'lunar', month: 1, day: 15, key: 'nguyen-tieu', name: { vi: 'Rằm tháng Giêng', en: 'Lantern Festival' } },
  { type: 'lunar', month: 3, day: 3, key: 'han-thuc', name: { vi: 'Tết Hàn thực', en: 'Cold Food Festival' } },
  { type: 'lunar', month: 3, day: 10, key: 'hung-kings', official: true, name: { vi: 'Giỗ Tổ Hùng Vương', en: 'Hung Kings Commemoration' } },
  { type: 'lunar', month: 4, day: 15, key: 'vesak', name: { vi: 'Lễ Phật Đản', en: 'Vesak' } },
  { type: 'lunar', month: 5, day: 5, key: 'doan-ngo', name: { vi: 'Tết Đoan Ngọ', en: 'Double Fifth Festival' } },
  { type: 'lunar', month: 7, day: 15, key: 'vu-lan', name: { vi: 'Lễ Vu Lan', en: 'Vu Lan Festival' } },
  { type: 'lunar', month: 8, day: 15, key: 'trung-thu', name: { vi: 'Tết Trung Thu', en: 'Mid-Autumn Festival' } },
  { type: 'lunar', month: 12, day: 23, key: 'ong-tao', name: { vi: 'Ông Công Ông Táo', en: 'Kitchen Gods Day' } },
];

/**
 * Holidays on a given day. Lunar holidays only match regular (non-leap) months.
 * `isLastLunarDayOfYear` adds Giao thừa (New Year's Eve, last day of month 12).
 */
export function holidaysOn(
  solar: { day: number; month: number },
  lunar: LunarDate,
  isLastLunarDayOfYear: boolean,
): Holiday[] {
  const out: Holiday[] = [];
  for (const r of HOLIDAY_RULES) {
    if (r.type === 'solar' && r.month === solar.month && r.day === solar.day) out.push(r);
    else if (r.type === 'lunar' && !lunar.leap && r.month === lunar.month && r.day === lunar.day) out.push(r);
  }
  if (isLastLunarDayOfYear) {
    out.unshift({ key: 'giao-thua', official: true, name: { vi: 'Giao thừa', en: "Lunar New Year's Eve" } });
  }
  return out;
}
