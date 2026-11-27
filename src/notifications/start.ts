/** Keeps OS notifications in step with the data: replan shortly after changes and every 10 minutes. */
import { planReminders, reminderBody } from '@/core/reminders/reminders';
import { useData } from '@/data/store';

import { applyReminders } from './scheduler';

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

export async function replanReminders() {
  const s = useData.getState();
  if (!s.loaded) return;
  const tz = s.settings.timeZone;
  const calendars = s.calendars;
  const shown = (id: string | null) => !id || (!!calendars[id] && !calendars[id].deletedAt && !calendars[id].archivedAt);
  const list = planReminders({
    events: Object.values(s.events).filter((e) => shown(e.calendarId)),
    tasks: Object.values(s.tasks).filter((t) => shown(t.calendarId)),
    tz,
    nowMs: Date.now(),
  });
  await applyReminders(list, (p) => reminderBody(p, s.settings.locale, tz));
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void replanReminders(), ms);
}

export function startReminders() {
  if (started) return;
  started = true;
  useData.subscribe((s, prev) => {
    if (s.events !== prev.events || s.tasks !== prev.tasks || s.calendars !== prev.calendars || s.settings.timeZone !== prev.settings.timeZone) schedule(1500);
  });
  setInterval(() => schedule(0), 10 * 60_000);
  schedule(500);
}
