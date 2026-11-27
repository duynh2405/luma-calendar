/**
 * ICS subscriptions (one-way: source → Luma). A feed keeps its own calendar (id derived from the feed id),
 * is refreshed on app start and every 6 hours while the app is open, and mirrors the source.
 * Browsers block most calendar hosts via CORS, so a failed direct fetch falls back to the Supabase
 * `ics-proxy` function (needs sign-in).
 */
import { uuidv7 } from '@/core/model/id';
import { supabase } from '@/sync/supabase';

import { recordStorage } from './storage';
import { useData } from './store';

const KEY = 'icsfeeds';
export interface Feed {
  id: string;
  url: string;
  name: string;
  lastFetchedAt?: string;
  lastError?: string | null;
  count?: number;
}

export async function loadFeeds(): Promise<Feed[]> {
  const all = await recordStorage.loadAll();
  return (all[KEY] as Feed[] | undefined) ?? [];
}
async function saveFeeds(feeds: Feed[]) {
  await recordStorage.putMany([[KEY, feeds]]);
}

async function fetchText(url: string): Promise<string> {
  const u = url.trim().replace(/^webcal:\/\//i, 'https://');
  try {
    const res = await fetch(u);
    if (res.ok) {
      const t = await res.text();
      if (t.includes('BEGIN:VCALENDAR')) return t;
    }
  } catch {
    // blocked by CORS or offline: try the proxy
  }
  if (!supabase) throw new Error('fetch-blocked');
  const { data, error } = await supabase.functions.invoke('ics-proxy', { body: { url: u } });
  if (error || !data?.text) throw new Error((data as { error?: string } | null)?.error ?? error?.message ?? 'proxy-failed');
  return data.text as string;
}

export async function refreshFeed(feed: Feed): Promise<Feed> {
  const { importIcsText } = await import('@/features/settings/ics-import');
  try {
    const text = await fetchText(feed.url);
    const r = importIcsText(text, feed.name, { calendarId: `ics-feed-${feed.id}`, name: feed.name, prune: true });
    return { ...feed, lastFetchedAt: new Date().toISOString(), lastError: null, count: r.parsed.events };
  } catch (e) {
    return { ...feed, lastError: e instanceof Error ? e.message : String(e) };
  }
}

export async function addFeed(url: string, name: string): Promise<Feed> {
  const feeds = await loadFeeds();
  const feed = await refreshFeed({ id: uuidv7().slice(-12), url: url.trim(), name: name.trim() || 'Lịch đăng ký' });
  await saveFeeds([...feeds, feed]);
  return feed;
}

export async function removeFeed(id: string, deleteEvents: boolean) {
  await saveFeeds((await loadFeeds()).filter((f) => f.id !== id));
  const s = useData.getState();
  if (deleteEvents) {
    const cal = `ics-feed-${id}`;
    for (const e of Object.values(s.events)) if (e.calendarId === cal && !e.deletedAt) s.deleteEvent(e.id);
    if (s.calendars[cal]) s.deleteCalendar(cal);
  }
}

export async function refreshAllFeeds(): Promise<void> {
  const feeds = await loadFeeds();
  if (!feeds.length) return;
  await saveFeeds(await Promise.all(feeds.map(refreshFeed)));
}

let started = false;
export function startFeedRefresh() {
  if (started) return;
  started = true;
  void refreshAllFeeds();
  setInterval(() => void refreshAllFeeds(), 6 * 3600_000);
}
