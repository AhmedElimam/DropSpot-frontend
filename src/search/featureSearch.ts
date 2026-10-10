import Fuse from 'fuse.js';
import type { FeatureEntry } from './featureIndex';

/**
 * Arabic as people type it: no diacritics or tatweel, every alef one alef, ة as ه, ى as ي,
 * hamza seats folded, Arabic-Indic digits as Latin, a leading «ال» on each word dropped,
 * spacing collapsed, Latin lower-cased. «فاتوره» finds «فاتورة», «الفلوس» finds «فلوس».
 */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w))
    .join(' ')
    .trim();
}

export interface Indexed {
  entry: FeatureEntry;
  title: string;
  sub: string;
  n_title: string;
  n_sub: string;
  n_keywords: string[];
}

/**
 * Fuzzy, weighted: a hit in the title counts most, then the words people use for it, then
 * the description. Typos and half-words still land («مصرو» → المصاريف).
 */
export function buildSearch(entries: FeatureEntry[], t: (k: string) => string): (q: string) => Indexed[] {
  const docs: Indexed[] = entries.map((e) => {
    const title = t(e.titleKey);
    const sub = e.subKey ? t(e.subKey) : '';
    return { entry: e, title, sub, n_title: normalizeArabic(title), n_sub: normalizeArabic(sub), n_keywords: e.keywords.map(normalizeArabic) };
  });
  const fuse = new Fuse(docs, {
    keys: [
      { name: 'n_title', weight: 3 },
      { name: 'n_keywords', weight: 2 },
      { name: 'n_sub', weight: 1 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  });
  return (q: string) => {
    const nq = normalizeArabic(q);
    if (nq.length < 2) return [];
    return fuse.search(nq, { limit: 12 }).map((r) => r.item);
  };
}
