/**
 * Class-grade names are stored canonically in English on the backend
 * ("Primary 1" … "Secondary 3", see GradeSeeder). The Arabic app must never show
 * those raw. This maps the canonical name to its Arabic label; anything
 * unrecognised (already-Arabic, or a future grade) is returned unchanged.
 *
 * Display-only — never send the localized string back to the API.
 */
const AR_ORDINAL = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'] as const;

const STAGE: Record<string, string> = {
  primary: 'الابتدائي',
  preparatory: 'الإعدادي',
  secondary: 'الثانوي',
};

export function localizeGrade(name?: string | null): string {
  if (!name) return '';
  const m = name.trim().match(/^(primary|preparatory|secondary)\s*(\d)$/i);
  if (!m) return name; // already Arabic or unknown — leave as-is
  const stage = STAGE[m[1].toLowerCase()];
  const n = Number(m[2]);
  const ordinal = AR_ORDINAL[n] ?? '';
  return `الصف ${ordinal} ${stage}`.trim();
}
