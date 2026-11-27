import { describe, expect, it } from 'vitest';

import { lunarOfDayKey } from '../lunar/lunar';
import { parseQuickAdd } from './quickadd';

// Friday 27/11/2026 (19/10 âm Bính Ngọ)
const today = '2026-11-27';
const calendars = [
  { id: 'media', name: 'Media' },
  { id: 'loa', name: 'Loa đài' },
];
const p = (s: string) => parseQuickAdd(s, { today, calendars, defaultDurationMin: 60 });

describe("owner's examples", () => {
  it('Mai 7h sáng setup loa đài tại nhà khách', () => {
    expect(p('Mai 7h sáng setup loa đài tại nhà khách')).toMatchObject({
      kind: 'event',
      day: '2026-11-28',
      startMin: 420,
      endMin: 480,
      title: 'Setup loa đài',
      location: 'nhà khách',
      allDay: false,
    });
  });
  it('Thứ Bảy quay đám cưới từ 8h đến 12h', () => {
    expect(p('Thứ Bảy quay đám cưới từ 8h đến 12h')).toMatchObject({
      kind: 'event',
      day: '2026-11-28',
      startMin: 480,
      endMin: 720,
      title: 'Quay đám cưới',
    });
  });
  it('Ngày 15 âm hằng tháng nhắc tôi', () => {
    const r = p('Ngày 15 âm hằng tháng nhắc tôi');
    expect(r.kind).toBe('event');
    expect(r.allDay).toBe(true);
    expect(r.recurrence).toMatchObject({ freq: 'lunarMonthly' });
    expect(r.reminders).toEqual([0]);
    expect(lunarOfDayKey(r.day!).day).toBe(15);
    expect(r.day! >= today).toBe(true);
  });
  it('Thứ Hai tuần sau trả video cho khách', () => {
    expect(p('Thứ Hai tuần sau trả video cho khách')).toMatchObject({
      kind: 'task',
      day: '2026-11-30',
      title: 'Trả video cho khách',
    });
  });
  it('Nhắc trước 1 ngày và trước 2 tiếng', () => {
    const r = p('Họp khách 9h thứ 4 nhắc trước 1 ngày và trước 2 tiếng');
    expect(r.reminders).toEqual([1440, 120]);
    expect(r).toMatchObject({ title: 'Họp khách', day: '2026-12-02', startMin: 540 });
  });
});

describe('dates', () => {
  it.each([
    ['hôm nay gọi khách', '2026-11-27'],
    ['ngay mai gui bao gia', '2026-11-28'],
    ['ngày mốt trả ảnh', '2026-11-29'],
    ['gửi file 5/12', '2026-12-05'],
    ['gửi file 05/12/2027', '2027-12-05'],
    ['ngày 30 chốt sổ', '2026-11-30'],
    ['ngày 3 chốt sổ', '2026-12-03'],
    ['cuối tuần dọn kho', '2026-11-28'],
    ['CN đi chợ', '2026-11-29'],
    ['t3 họp', '2026-12-01'],
  ])('%s → %s', (input, day) => {
    expect(p(input).day).toBe(day);
  });
  it('past dd/mm rolls to next year and says so', () => {
    const r = p('sinh nhật 3/1');
    expect(r.day).toBe('2027-01-03');
    expect(r.ambiguous).toContain('date-rolled-forward');
  });
  it('a name like "chị Mai" is not a date', () => {
    const r = p('gặp chị Mai lúc 9h');
    expect(r.title).toBe('Gặp chị Mai');
    expect(r.day).toBe(today);
    expect(r.startMin).toBe(540);
  });
  it('same weekday as today is today, flagged', () => {
    const r = p('thứ 6 tổng kết');
    expect(r.day).toBe(today);
    expect(r.ambiguous).toContain('weekday-today');
  });
  it('no date → Inbox task', () => {
    expect(p('mua dây XLR')).toMatchObject({ kind: 'task', day: null, title: 'Mua dây XLR' });
  });
});

describe('times', () => {
  it.each([
    ['họp 7h30', 450, 510],
    ['họp 19h', 1140, 1200],
    ['họp 7h tối', 1140, 1200],
    ['họp 7 tối', 1140, 1200],
    ['tối nay 8h xem lại bản dựng', 1200, 1260],
    ['chiều mai 2h quay', 840, 900],
    ['8-12h chạy chương trình', 480, 720],
    ['từ 2 đến 5h chiều soundcheck', 840, 1020],
    ['12 trưa ăn cơm', 720, 780],
    ['họp 7:45', 465, 525],
  ])('%s', (input, s, e) => {
    const r = p(input);
    expect([r.startMin, r.endMin]).toEqual([s, e]);
    expect(r.kind).toBe('event');
  });
  it('3h without part of day is guessed as 15:00 and flagged', () => {
    const r = p('gặp khách 3h');
    expect(r.startMin).toBe(900);
    expect(r.ambiguous).toContain('hour-pm-guess');
  });
  it('a plain number is not a time', () => {
    expect(p('mua 8 cái loa').startMin).toBeNull();
  });
});

describe('recurrence, calendar, priority', () => {
  it('weekly on a weekday', () => {
    const r = p('mỗi thứ 2 họp team 9h');
    expect(r.recurrence).toEqual({ freq: 'weekly', interval: 1, byWeekday: [1] });
    expect(r.day).toBe('2026-11-30');
    expect(r.title).toBe('Họp team');
  });
  it('lunar yearly anniversary', () => {
    const r = p('giỗ ông nội 10/3 âm hằng năm');
    expect(r.recurrence).toMatchObject({ freq: 'lunarYearly' });
    expect(r.day).toBe('2027-04-16');
    expect(lunarOfDayKey(r.day!)).toMatchObject({ day: 10, month: 3 });
    expect(r.title).toBe('Giỗ ông nội');
  });
  it('daily without a date starts today', () => {
    expect(p('tập thể dục hằng ngày 6h sáng')).toMatchObject({ day: today, startMin: 360, recurrence: { freq: 'daily' } });
  });
  it('#calendar and !priority', () => {
    const r = p('trả ảnh cưới #media !3 thứ 2 tuần sau');
    expect(r).toMatchObject({ calendarId: 'media', priority: 3, title: 'Trả ảnh cưới', day: '2026-11-30', kind: 'task' });
    expect(p('kiểm kê #loadai').calendarId).toBe('loa');
  });
  it('reports spans for highlighting', () => {
    const r = p('Mai 7h sáng setup loa đài');
    expect(r.spans.map((s) => s.type)).toEqual(['date', 'time']);
  });
  it('words like "tài liệu" are not a location', () => {
    expect(p('gửi tài liệu cho khách').location).toBe('');
  });
});

describe('spoken forms', () => {
  const o = { today: '2026-11-27' };
  it('understands "3 giờ chiều" and "3 giờ rưỡi chiều"', () => {
    expect(parseQuickAdd('họp khách mai 3 giờ chiều', o).startMin).toBe(15 * 60);
    expect(parseQuickAdd('họp khách mai 3 giờ rưỡi chiều', o).startMin).toBe(15 * 60 + 30);
    expect(parseQuickAdd('chốt kèo 9 giờ sáng', o).startMin).toBe(9 * 60);
  });
});
