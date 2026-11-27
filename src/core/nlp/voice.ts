/**
 * Spoken-task formula → quick-add syntax.
 *
 *   "Việc <tên>, hạn <ngày giờ>, ưu tiên <cao|vừa|thấp>, danh mục <tên lịch>, nhắc trước <…>"
 *
 * Speech recognition gives plain text without "#" or "!", so keywords are translated into what
 * parseQuickAdd already understands. Everything else (dates, times, reminders) is left to the parser.
 * Matching ignores diacritics, since speech engines are inconsistent with them.
 */
import { fold, foldChars } from '../text/normalize';

export interface VoiceResult {
  text: string;
  /** The sentence started with "việc / công việc / task": it is a task, not an event. */
  forceTask: boolean;
}

/** Replace regex matches (run on the folded text) in the original text, 1:1 char mapping. */
function sub(input: string, rx: RegExp, fn: (m: RegExpExecArray) => string): string {
  const { original, folded } = foldChars(input);
  let out = '';
  let last = 0;
  rx.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(folded))) {
    if (m[0].length === 0) {
      rx.lastIndex++;
      continue;
    }
    out += original.slice(last, m.index) + fn(m);
    last = m.index + m[0].length;
  }
  return out + original.slice(last);
}

const W = '(?<![\\p{L}\\p{N}])';
const E = '(?![\\p{L}\\p{N}])';
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PRIORITY: Record<string, string> = {
  'rat cao': '!3',
  cao: '!3',
  'khan cap': '!3',
  gap: '!3',
  'trung binh': '!2',
  vua: '!2',
  'binh thuong': '!2',
  thap: '!1',
  'khong gap': '!1',
};

export function applyVoiceFormula(input: string, calendars: { id: string; name: string }[] = []): VoiceResult {
  let text = input.trim();
  let forceTask = false;

  // 1. Leading "việc …" marks a task.
  const lead = foldChars(text).folded.match(/^\s*(?:(?:them|tao)\s+)?(?:cong viec|nhiem vu|viec|task)(?:\s+moi)?\s*[:,]?\s+(?=\S)/u);
  if (lead) {
    forceTask = true;
    text = text.slice(lead[0].length);
  }

  // 2. "ưu tiên cao" → !3
  const prio = Object.keys(PRIORITY)
    .sort((a, b) => b.length - a.length)
    .map(escapeRx)
    .join('|');
  text = sub(text, new RegExp(`${W}uu tien (${prio})${E}`, 'gu'), (m) => ` ${PRIORITY[m[1]]} `);

  // 3. "danh mục Media" / "lịch Khách hàng" → #media (only when a calendar of that name exists)
  const names = [...calendars].sort((a, b) => b.name.length - a.name.length);
  for (const c of names) {
    const n = escapeRx(fold(c.name));
    text = sub(text, new RegExp(`${W}(?:thuoc danh muc|danh muc|thuoc lich|lich|nhom) ${n}${E}`, 'gu'), () => ` #${fold(c.name).replace(/\s+/g, '')} `);
  }

  // 4. "hạn / hạn chót / deadline" are only signposts; the date itself is read by the parser.
  text = sub(text, new RegExp(`${W}(?:han chot|deadline|han)${E}[\\s:]*`, 'gu'), () => '');

  return { text: text.replace(/\s{2,}/g, ' ').trim(), forceTask };
}
