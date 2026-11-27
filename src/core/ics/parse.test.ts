import { describe, expect, it } from 'vitest';

import { expandEvents } from '../recurrence/expand';
import { icsEventId, parseIcs } from './parse';

const opts = { calendarId: 'cal1', defaultTz: 'Asia/Ho_Chi_Minh', now: '2026-11-27T00:00:00.000Z' };
const wrap = (body: string) => `BEGIN:VCALENDAR\r\nX-WR-CALNAME:Công việc\r\n${body}\r\nEND:VCALENDAR\r\n`;

describe('parseIcs', () => {
  it('reads timed UTC, TZID, all-day, escapes and folded lines', () => {
    const r = parseIcs(
      wrap(`BEGIN:VEVENT
UID:a@x
DTSTART:20261130T020000Z
DTEND:20261130T033000Z
SUMMARY:Họp khách\, quan trọng
LOCATION:Quận 1
DESCRIPTION:Dòng 1\\nDòng
 2
END:VEVENT
BEGIN:VEVENT
UID:b@x
DTSTART;TZID=Asia/Ho_Chi_Minh:20261201T090000
DTEND;TZID=Asia/Ho_Chi_Minh:20261201T100000
SUMMARY:Setup
BEGIN:VALARM
TRIGGER:-PT30M
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:c@x
DTSTART;VALUE=DATE:20261205
DTEND;VALUE=DATE:20261207
SUMMARY:Quay 2 ngày
END:VEVENT`),
      opts,
    );
    expect(r.calendarName).toBe('Công việc');
    expect(r.events).toHaveLength(3);
    const [a, b, c] = r.events;
    expect(a.title).toBe('Họp khách, quan trọng');
    expect(a.start).toBe('2026-11-30T02:00:00.000Z');
    expect(a.description).toBe('Dòng 1\nDòng2');
    expect(b.start).toBe('2026-12-01T02:00:00.000Z');
    expect(b.reminders).toEqual([30]);
    expect(c.allDay && c.start === '2026-12-05' && c.end === '2026-12-07').toBe(true);
  });

  it('is idempotent by UID and skips cancelled', () => {
    const body = `BEGIN:VEVENT
UID:z
DTSTART:20261130T020000Z
SUMMARY:X
STATUS:CANCELLED
END:VEVENT`;
    const r = parseIcs(wrap(body), opts);
    expect(r.events).toHaveLength(0);
    expect(r.stats.skipped).toBe(1);
    expect(icsEventId('c', 'u')).toBe(icsEventId('c', 'u'));
    expect(icsEventId('c', 'u')).not.toBe(icsEventId('c2', 'u'));
  });

  it('maps RRULE, EXDATE and overrides', () => {
    const r = parseIcs(
      wrap(`BEGIN:VEVENT
UID:r
DTSTART;TZID=Asia/Ho_Chi_Minh:20261102T080000
DTEND;TZID=Asia/Ho_Chi_Minh:20261102T090000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6
EXDATE;TZID=Asia/Ho_Chi_Minh:20261104T080000
SUMMARY:Tập
END:VEVENT
BEGIN:VEVENT
UID:r
RECURRENCE-ID;TZID=Asia/Ho_Chi_Minh:20261109T080000
DTSTART;TZID=Asia/Ho_Chi_Minh:20261109T100000
DTEND;TZID=Asia/Ho_Chi_Minh:20261109T110000
SUMMARY:Tập (dời)
END:VEVENT`),
      opts,
    );
    const [m, o] = r.events;
    expect(m.recurrence).toMatchObject({ freq: 'weekly', byWeekday: [1, 3], count: 6 });
    expect(m.exdates).toEqual(['2026-11-04']);
    expect(o.recurrenceMasterId).toBe(m.id);
    expect(o.recurrenceDay).toBe('2026-11-09');
    const occ = expandEvents(r.events, '2026-11-01', '2026-11-30', opts.defaultTz);
    expect(occ.length).toBe(5);
  });
});
