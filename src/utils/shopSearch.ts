import { foldForSearch } from '@/utils/format';

/**
 * Smart search for the print shops page (founder 2026-10-14: «search isn't smart — it doesn't
 * give suggestions»). A teacher types the way she talks — «ألوان رخيص», «سلك قريب», «مستعجل
 * توصيل», a shop's name half-typed or with a typo — and gets:
 *
 *   - intents read out of the words: a sort («أرخص» → cheapest, «قريب» → nearest, «مستعجل» →
 *     fastest, «أحسن» → top rated) and capabilities («ألوان», «سلك», «توصيل», «A5»…), which
 *     filter instead of being searched for as text;
 *   - the shops whose name / area / tagline / labels / extras match the remaining words —
 *     Arabic folded (أ/إ/آ→ا, ة→ه, ى→ي, Arabic digits), prefix or substring, one typo allowed
 *     on longer words;
 *   - suggestions to tap: the intents found, matching shops, matching areas.
 */

export type SortKey = 'recommended' | 'nearest' | 'fastest' | 'cheapest' | 'top_rated';

export interface SearchableShop {
  vendor_id: number;
  name: string;
  city?: string | null;
  tagline?: string | null;
  quality_label?: string | null;
  ink_tech_label?: string | null;
  capabilities: string[];
  extras?: { name: string }[];
  logo?: string | null;
}

export type Suggestion =
  | { kind: 'sort'; key: SortKey }
  | { kind: 'filter'; key: string }
  | { kind: 'shop'; id: number; name: string; sub: string | null; logo: string | null }
  | { kind: 'area'; text: string };

/** Words that ask for an order, not a name. Folded forms. */
const SORT_WORDS: Record<Exclude<SortKey, 'recommended'>, string[]> = {
  cheapest: ['ارخص', 'رخيص', 'رخيصه', 'اقل سعر', 'اوفر', 'ارخص حاجه'],
  nearest: ['اقرب', 'قريب', 'قريبه', 'جنبي', 'جمبي', 'قريب مني'],
  fastest: ['اسرع', 'سريع', 'سريعه', 'بسرعه', 'النهارده'],
  top_rated: ['احسن', 'افضل', 'تقييم', 'الاعلي', 'اعلي تقييم', 'جوده'],
};

/** Everyday words for what a shop can do → the capability key. Folded forms. */
const CAPABILITY_WORDS: Record<string, string[]> = {
  color: ['الوان', 'ملون', 'كلر', 'color', 'colour'],
  color_hq: ['فوتوغرافي', 'صور'],
  delivery: ['توصيل', 'دليفري', 'ديليفري', 'delivery', 'يوصل'],
  duplex: ['وجهين', 'دبلكس', 'duplex'],
  spiral: ['سلك', 'حلزوني', 'سبيرال', 'سبايرال', 'spiral'],
  staple: ['دبوس', 'تدبيس', 'دباسه'],
  glue: ['تجليد', 'لاصق', 'كعب'],
  laminate: ['تغليف', 'سلوفان', 'حراري'],
  cover: ['غلاف'],
  punch: ['خرم', 'تخريم'],
  glossy: ['لامع', 'كوشيه'],
  heavy: ['تقيل', 'سميك'],
  special_paper: ['كرتون', 'مقوي'],
  rush: ['مستعجل', 'ضروري', 'urgent'],
  bulk: ['كميات', 'جمله', 'خصم'],
  a5: ['a5', 'نص فرخ'],
  a3: ['a3'],
};

/** Levenshtein distance, early-exiting above `max` (the strings here are single short words). */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Does one typed word match this text? Prefix of a word, substring (2+ letters), or one typo (4+ letters). */
export function wordMatches(text: string, token: string): boolean {
  if (!token) return true;
  if (!text) return false;
  if (token.length >= 2 && text.includes(token)) return true;
  const words = text.split(/[\s،,.\-—/()«»]+/).filter(Boolean);
  for (const w of words) {
    if (w.startsWith(token)) return true;
    // «ال» is part of the word in Arabic: «مطبعه» should find «المطبعه» and back.
    const bare = w.startsWith('ال') && w.length > 3 ? w.slice(2) : w;
    const tBare = token.startsWith('ال') && token.length > 3 ? token.slice(2) : token;
    if (bare.startsWith(tBare)) return true;
    if (tBare.length >= 4 && editDistance(bare.slice(0, tBare.length + 1), tBare, 1) <= 1) return true;
    if (tBare.length >= 4 && editDistance(bare, tBare, 1) <= 1) return true;
  }
  return false;
}

const fold = (s: string | null | undefined) => foldForSearch(s ?? '');

/** Which phrase list holds this text (whole phrase or one of its words)? */
function findIn(map: Record<string, string[]>, text: string): string[] {
  const hits: string[] = [];
  for (const [key, words] of Object.entries(map)) {
    if (words.some((w) => w === text || (text.length >= 3 && w.length >= 3 && (w.startsWith(text) || text.startsWith(w) || (text.length >= 4 && editDistance(w, text, 1) <= 1))))) hits.push(key);
  }
  return hits;
}

export interface ParsedQuery {
  /** The sort the words asked for, if any. */
  sort: SortKey | null;
  /** Capabilities the words asked for (keys). */
  caps: string[];
  /** Words left to match against the shops themselves. */
  rest: string[];
  /** The word each capability was read from — a shop also answers when that word is in its own text. */
  capWords: Record<string, string>;
}

/**
 * Read a query: multi-word phrases first («اقل سعر»), then each word — a sort word, a
 * capability (by everyday word or by the label the app shows), or a word to search for.
 */
export function parseQuery(query: string, capLabels: Record<string, string> = {}): ParsedQuery {
  let q = fold(query);
  let sort: SortKey | null = null;
  const caps = new Set<string>();
  const capWords: Record<string, string> = {};
  // phrases with a space, longest first
  const phrases: [string, 'sort' | 'cap', string][] = [];
  for (const [k, ws] of Object.entries(SORT_WORDS)) for (const w of ws) if (w.includes(' ')) phrases.push([w, 'sort', k]);
  for (const [k, ws] of Object.entries(CAPABILITY_WORDS)) for (const w of ws) if (w.includes(' ')) phrases.push([w, 'cap', k]);
  for (const [k, label] of Object.entries(capLabels)) { const f = fold(label); if (f.includes(' ')) phrases.push([f, 'cap', k]); }
  phrases.sort((a, b) => b[0].length - a[0].length);
  for (const [p, kind, key] of phrases) {
    if (q.includes(p)) {
      if (kind === 'sort') sort = sort ?? (key as SortKey); else { caps.add(key); capWords[key] = p; }
      q = q.replace(p, ' ');
    }
  }
  const labelWords: Record<string, string[]> = {};
  for (const [k, label] of Object.entries(capLabels)) labelWords[k] = [fold(label)];
  const rest: string[] = [];
  for (const token of q.split(' ').filter(Boolean)) {
    const s = findIn(SORT_WORDS, token);
    if (s.length) { sort = sort ?? (s[0] as SortKey); continue; }
    // An everyday word wins; a label only when no everyday word matched (so «ألوان» is colour,
    // not also «ألوان فوتوغرافي» — every capability read is required, so extras would hide shops).
    const everyday = findIn(CAPABILITY_WORDS, token);
    const c = everyday.length ? everyday : findIn(labelWords, token).slice(0, 1);
    if (c.length) { c.forEach((k) => { caps.add(k); capWords[k] = token; }); continue; }
    if (token.length === 1 && !/[0-9a-z]/.test(token)) continue; // a stray «و» etc.
    rest.push(token);
  }
  return { sort, caps: [...caps], rest, capWords };
}

/** Everything about a shop a word can hit, folded once. */
function haystack(s: SearchableShop, capLabels: Record<string, string>): string {
  return fold([s.name, s.city, s.tagline, s.quality_label, s.ink_tech_label,
    ...s.capabilities.map((c) => capLabels[c] ?? ''), ...(s.extras ?? []).map((x) => x.name)].filter(Boolean).join(' | '));
}

/** Does the shop answer the query? Every capability asked for, and every remaining word somewhere. */
export function shopMatches(s: SearchableShop, parsed: ParsedQuery, capLabels: Record<string, string> = {}): boolean {
  const hay = haystack(s, capLabels);
  if (!parsed.caps.every((c) => s.capabilities.includes(c) || (parsed.capWords[c] != null && wordMatches(hay, parsed.capWords[c])))) return false;
  return parsed.rest.every((tok) => wordMatches(hay, tok));
}

/** How well the name matches — used to put the best shop suggestions first. */
function nameScore(s: SearchableShop, rest: string[]): number {
  const n = fold(s.name);
  if (!rest.length) return 1;
  const q = rest.join(' ');
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  return rest.filter((t) => wordMatches(n, t)).length * 10;
}

/**
 * What to offer under the search field while she types: the intents read from her words
 * (tap = apply), then up to 5 matching shops (best name match first), then matching areas.
 */
export function suggest(query: string, shops: SearchableShop[], capLabels: Record<string, string> = {}): Suggestion[] {
  const parsed = parseQuery(query, capLabels);
  const out: Suggestion[] = [];
  if (parsed.sort) out.push({ kind: 'sort', key: parsed.sort });
  for (const c of parsed.caps) out.push({ kind: 'filter', key: c });
  // A capability whose label starts with what is being typed (still typing «سل…»).
  const last = fold(query).split(' ').filter(Boolean).pop() ?? '';
  if (last.length >= 2) {
    for (const [k, label] of Object.entries(capLabels)) {
      if (!parsed.caps.includes(k) && fold(label).startsWith(last) && shops.some((s) => s.capabilities.includes(k))) out.push({ kind: 'filter', key: k });
    }
  }
  const matches = shops.filter((s) => shopMatches(s, parsed, capLabels))
    .sort((a, b) => nameScore(b, parsed.rest) - nameScore(a, parsed.rest))
    .slice(0, 5);
  if (parsed.rest.length) {
    for (const s of matches) out.push({ kind: 'shop', id: s.vendor_id, name: s.name, sub: s.city ?? s.tagline ?? null, logo: s.logo ?? null });
    const areas = new Set<string>();
    for (const s of shops) {
      if (s.city && parsed.rest.every((t) => wordMatches(fold(s.city), t))) areas.add(s.city);
    }
    for (const a of areas) out.push({ kind: 'area', text: a });
  }
  // one of each
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = x.kind === 'shop' ? `s${x.id}` : x.kind === 'area' ? `a${x.text}` : `${x.kind}${x.key}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Straight-line kilometres between two points (haversine) — «2.3 كم من ميدان الساعة». */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The teacher's own places (centres, schools) whose name or address has every typed word. */
export function matchPlaces<T extends { name: string; address?: string | null }>(query: string, places: T[]): T[] {
  const words = fold(query).split(' ').filter((w) => w.length >= 2);
  if (!words.length) return [];
  return places.filter((p) => {
    const hay = fold(`${p.name} ${p.address ?? ''}`);
    return words.every((w) => wordMatches(hay, w));
  });
}

/** Does the query leave words that no shop, area or intent explains — worth asking the map for a place? */
export function wantsPlace(query: string, shops: SearchableShop[], capLabels: Record<string, string> = {}): boolean {
  const parsed = parseQuery(query, capLabels);
  if (!parsed.rest.length || parsed.rest.join('').length < 3) return false;
  return !shops.some((s) => shopMatches(s, { ...parsed, caps: [], capWords: {} }, capLabels));
}
