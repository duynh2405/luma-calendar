import { describe, expect, it } from 'vitest';

import { applyVoiceFormula } from './voice';
import { parseQuickAdd } from './quickadd';

const cals = [
  { id: 'c1', name: 'Lịch của tôi' },
  { id: 'c2', name: 'Media' },
  { id: 'c3', name: 'Khách hàng' },
];
const today = '2026-11-27'; // Friday
const run = (s: string) => {
  const v = applyVoiceFormula(s, cals);
  return { v, r: parseQuickAdd(v.text, { today, calendars: cals }) };
};

describe('voice formula', () => {
  it('fills title, due date, priority and calendar from a spoken sentence', () => {
    const { v, r } = run('Việc gửi báo giá cho khách, hạn thứ hai tuần sau, ưu tiên cao, danh mục Media');
    expect(v.forceTask).toBe(true);
    expect(r.title.toLowerCase()).toContain('gửi báo giá cho khách');
    expect(r.day).toBe('2026-11-30');
    expect(r.priority).toBe(3);
    expect(r.calendarId).toBe('c2');
  });

  it('works without diacritics (speech engines are inconsistent)', () => {
    const { v, r } = run('cong viec sua anh cuoi han ngay mai uu tien thap lich khach hang');
    expect(v.forceTask).toBe(true);
    expect(r.day).toBe('2026-11-28');
    expect(r.priority).toBe(1);
    expect(r.calendarId).toBe('c3');
  });

  it('reads reminder and time too', () => {
    const { r } = run('Việc chốt phương án hạn mai 3 giờ chiều nhắc trước 1 ngày');
    expect(r.day).toBe('2026-11-28');
    expect(r.startMin).toBe(15 * 60);
    expect(r.reminders).toContain(1440);
  });

  it('leaves an ordinary sentence alone', () => {
    const v = applyVoiceFormula('Mai 7h sáng setup loa đài', cals);
    expect(v.forceTask).toBe(false);
    expect(v.text).toBe('Mai 7h sáng setup loa đài');
  });

  it('does not treat "lịch" in a title as a calendar unless the name exists', () => {
    const v = applyVoiceFormula('Việc sắp lịch họp tuần sau', cals);
    expect(v.text).not.toContain('#');
  });
});
