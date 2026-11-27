/** Import an .ics file as its own calendar (stable ids: importing again updates, never duplicates). */
import { parseIcs } from '@/core/ics/parse';
import { BACKUP_APP, BACKUP_SCHEMA } from '@/core/model/backup';
import { nowIso } from '@/core/model/id';
import { useData } from '@/data/store';

const COLORS = ['#5b6bb0', '#c0765a', '#4f8a78', '#a07cc0', '#b8923f', '#5a8fb8'];

export function importIcsText(text: string, fileName: string, opt: { calendarId?: string; name?: string; prune?: boolean } = {}) {
  const s = useData.getState();
  const base = fileName.replace(/\.ics$/i, '').trim() || 'ICS';
  // First pass only to read the calendar name; ids need the calendar id, which comes from the name.
  const name = (opt.name ?? parseIcs(text, { calendarId: 'x', defaultTz: s.settings.timeZone }).calendarName ?? base).slice(0, 60);
  let h = 0;
  for (const c of name) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  const calendarId = opt.calendarId ?? `ics-cal-${h.toString(16)}`;
  const res = parseIcs(text, { calendarId, defaultTz: s.settings.timeZone });
  const now = nowIso();
  const existing = s.calendars[calendarId];
  const backup = {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: now,
    settings: s.settings,
    calendars: existing
      ? []
      : [
          {
            id: calendarId,
            name,
            color: COLORS[h % COLORS.length],
            icon: 'calendar',
            sortOrder: Object.keys(s.calendars).length,
            visible: true,
            isDefault: false,
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        ],
    events: res.events,
    tasks: [],
  };
  const stats = s.importBackup(JSON.stringify(backup));
  if (opt.prune) {
    // Feeds mirror their source: events that disappeared upstream are removed here too.
    const keep = new Set(res.events.map((e) => e.id));
    for (const e of Object.values(useData.getState().events))
      if (e.calendarId === calendarId && !e.deletedAt && !keep.has(e.id)) useData.getState().deleteEvent(e.id);
  }
  return { stats, parsed: res.stats, name };
}
