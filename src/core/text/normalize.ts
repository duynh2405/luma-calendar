/**
 * Vietnamese text normalization for search and parsing:
 * lowercase, remove tone marks and diacritics, đ → d.
 * `foldChars` keeps a 1:1 character mapping so match positions in the folded
 * string are valid in the original string.
 */

/** Fold one character: "Ế" → "e", "đ" → "d". */
function foldChar(ch: string): string {
  if (ch === 'đ' || ch === 'Đ') return 'd';
  const base = ch.normalize('NFD')[0] ?? ch;
  return base.toLowerCase();
}

/** Same length as the (NFC) input; each character folded. */
export function foldChars(input: string): { original: string; folded: string } {
  const original = input.normalize('NFC');
  let folded = '';
  for (const ch of original) folded += foldChar(ch).length === 1 ? foldChar(ch) : ch.toLowerCase();
  // Characters outside the BMP take 2 code units; keep lengths aligned.
  if (folded.length !== original.length) return { original, folded: original.toLowerCase() };
  return { original, folded };
}

export function fold(input: string): string {
  return foldChars(input).folded.replace(/\s+/g, ' ').trim();
}

/** Every search term (accent-insensitive) must appear in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const h = fold(haystack);
  const terms = fold(query).split(' ').filter(Boolean);
  return terms.length > 0 && terms.every((t) => h.includes(t));
}
