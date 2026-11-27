import { describe, expect, it } from 'vitest';

import { formatDayKeyVi, parseDateText, parseTimeText } from './parse';

describe('parseTimeText', () => {
  it.each([
    ['7', 420],
    ['7h', 420],
    ['7h30', 450],
    ['7 giờ 30', 450],
    ['07:30', 450],
    ['730', 450],
    ['1930', 1170],
    ['19.30', 1170],
    ['7:30 pm', 1170],
    ['7h tối', 1140],
    ['2 chiều', 840],
    ['12 trưa', 720],
    ['1 trưa', 780],
    ['12am', 0],
    ['11 đêm', 1380],
    ['0:00', 0],
    ['23:59', 1439],
  ])('%s → %i', (input, expected) => {
    expect(parseTimeText(input)).toBe(expected);
  });
  it.each(['', 'abc', '25', '7:75', '99h'])('rejects %s', (input) => {
    expect(parseTimeText(input)).toBeNull();
  });
});

describe('parseDateText', () => {
  const ref = '2026-11-27';
  it.each([
    ['25/11', '2026-11-25'],
    ['25/11/2027', '2027-11-25'],
    ['5-1-27', '2027-01-05'],
    ['2026-02-28', '2026-02-28'],
    ['29.2.2028', '2028-02-29'],
  ])('%s → %s', (input, expected) => {
    expect(parseDateText(input, ref)).toBe(expected);
  });
  it.each(['31/11', '29/2/2026', '0/1', 'hello'])('rejects %s', (input) => {
    expect(parseDateText(input, ref)).toBeNull();
  });
  it('formats dd/mm/yyyy', () => {
    expect(formatDayKeyVi('2026-01-05')).toBe('05/01/2026');
  });
});
