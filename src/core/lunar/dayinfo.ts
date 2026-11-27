import { addDays, type DayKey, parseDayKey } from '../time/days';
import { type Holiday, holidaysOn } from './holidays';
import { type LunarDate, lunarOfDayKey } from './lunar';

export interface DayInfo {
  lunar: LunarDate;
  holidays: Holiday[];
  /** mùng 1 or rằm (15) */
  isLunarMarker: boolean;
}

const cache = new Map<DayKey, DayInfo>();

export function dayInfo(day: DayKey): DayInfo {
  let v = cache.get(day);
  if (!v) {
    const lunar = lunarOfDayKey(day);
    const next = lunarOfDayKey(addDays(day, 1));
    const isLastOfYear = lunar.month === 12 && !lunar.leap && next.day === 1 && next.month === 1;
    const { m, d } = parseDayKey(day);
    v = {
      lunar,
      holidays: holidaysOn({ day: d, month: m }, lunar, isLastOfYear),
      isLunarMarker: lunar.day === 1 || lunar.day === 15,
    };
    if (cache.size > 3000) cache.clear();
    cache.set(day, v);
  }
  return v;
}
