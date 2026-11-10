/**
 * The amount a shared transfer receipt states, when it came as text (InstaPay and Vodafone
 * Cash share a sentence with the sum, e.g. «تم تحويل 350.00 جنيه» or «EGP 1,200.00»).
 * Used only to pre-select the matching invoice; the parent still confirms. Null when no
 * amount is named next to a currency word.
 */
const ARABIC_DIGITS = /[٠-٩]/g;
const CURRENCY = '(?:EGP|LE|L\\.E|جنيه|جنيهاً|جنيها|ج\\.م|ج\\s?م|جم)';
const NUMBER = '(\\d{1,3}(?:[,٬]\\d{3})+(?:[.٫]\\d{1,2})?|\\d+(?:[.٫]\\d{1,2})?)';

export function parseReceiptAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  const s = text.replace(ARABIC_DIGITS, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const after = new RegExp(`${NUMBER}\\s*${CURRENCY}`, 'i').exec(s);
  const before = new RegExp(`${CURRENCY}\\s*${NUMBER}`, 'i').exec(s);
  const raw = after?.[1] ?? before?.[1];
  if (!raw) return null;
  const n = Number(raw.replace(/[,٬]/g, '').replace('٫', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
