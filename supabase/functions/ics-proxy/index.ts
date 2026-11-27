// Fetches a public .ics URL on behalf of a signed-in user (browsers block most calendar hosts via CORS).
// Safety: https only, no credentials in URL, no private/loopback hosts, no redirects, 5 MB cap, 10 s timeout.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

function blockedHost(h: string): boolean {
  const host = h.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return host.includes(':') || host.startsWith('[');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
  try {
    const { url } = await req.json();
    const u = new URL(String(url).replace(/^webcal:\/\//i, 'https://'));
    if (u.protocol !== 'https:' || u.username || u.password || blockedHost(u.hostname)) return json({ error: 'url-not-allowed' }, 400);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(u, { signal: ctrl.signal, redirect: 'manual', headers: { accept: 'text/calendar, text/plain' } });
    clearTimeout(timer);
    if (!res.ok) return json({ error: `upstream-${res.status}` }, 502);
    const text = await res.text();
    if (text.length > 5_000_000) return json({ error: 'too-large' }, 413);
    if (!text.includes('BEGIN:VCALENDAR')) return json({ error: 'not-ics' }, 422);
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
