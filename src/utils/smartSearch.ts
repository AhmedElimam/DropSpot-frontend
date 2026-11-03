/**
 * The students tab search (founder 2026-11-03: «make it smarter»). Typed Arabic rarely matches
 * stored Arabic letter for letter, so both sides are folded first: hamza forms of alef, ة/ه,
 * ى/ي, ؤ/و, ئ/ي, tashkeel and tatweel, Arabic-Indic digits, and «عبد الله» = «عبدالله».
 * Every word typed must match somewhere (any order): the name, the code, the student's or a
 * parent's number (any 3+ digits of it, with or without +20), or a group's name.
 */

const MARKS = /[ً-ٰٟـ]/g; // tashkeel, superscript alef, tatweel

/** Folded text for comparing: lower case, no marks, one alef / yaa / haa, Western digits. */
export function normalizeArabic(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim();
}

/** A phone number's digits, written the local way (+20 1… / 0020 1… → 01…). */
export function phoneDigits(s: string | null | undefined): string {
  const d = normalizeArabic(s).replace(/\D/g, '');
  if (d.startsWith('0020')) return '0' + d.slice(4);
  if (d.startsWith('20') && d.length === 12) return '0' + d.slice(2);
  return d;
}

export interface Searchable {
  name?: string | null;
  code?: string | null;
  phones?: (string | null | undefined)[];
  /** Other words the item answers to — its groups' names. */
  tags?: (string | null | undefined)[];
}

/**
 * How well `item` answers `query`: 0 = no match (some word matched nothing), higher = better.
 * An empty query matches everything with score 1.
 */
export function searchScore(item: Searchable, query: string): number {
  const q = normalizeArabic(query);
  if (!q) return 1;

  const name = normalizeArabic(item.name);
  const nameTight = name.replace(/ /g, '');
  const words = name.split(' ');
  const code = normalizeArabic(item.code);
  const phones = (item.phones ?? []).map(phoneDigits).filter(Boolean);
  const tags = (item.tags ?? []).map(normalizeArabic).filter(Boolean);

  // The whole query: an exact code, or the name's start, ranks first.
  let score = 0;
  if (code && code === q) score += 100;
  if (name.startsWith(q) || nameTight.startsWith(q.replace(/ /g, ''))) score += 20;

  for (const token of q.split(' ')) {
    const digits = /^[+\d]+$/.test(token) ? phoneDigits(token) : '';
    let best = 0;
    if (words.some((w) => w.startsWith(token))) best = Math.max(best, 6);
    else if (name.includes(token) || nameTight.includes(token)) best = Math.max(best, 4);
    if (code.includes(token)) best = Math.max(best, code.startsWith(token) ? 6 : 4);
    if (digits.length >= 3 && phones.some((p) => p.includes(digits))) best = Math.max(best, phoneRank(phones, digits));
    if (tags.some((tag) => tag.includes(token))) best = Math.max(best, 2);
    if (best === 0) return 0;
    score += best;
  }

  return score;
}

/** A whole number typed scores like an exact code; a fragment of one like a word. */
function phoneRank(phones: string[], digits: string): number {
  return phones.some((p) => p === digits) ? 8 : 5;
}
