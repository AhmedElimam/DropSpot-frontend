/**
 * A mark typed into a field: Arabic-Indic (٠-٩) or Persian (۰-۹) digits from an Arabic
 * keyboard, and an Arabic decimal comma (٫ or ,), are read the same as 0-9 and «.».
 */

/** Keeps what a mark can be made of, in Latin digits, with at most one decimal point. */
export function cleanMarkInput(text: string): string {
  const latin = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,،]/g, '.')
    .replace(/[^0-9.]/g, '');
  const dot = latin.indexOf('.');
  return dot === -1 ? latin : latin.slice(0, dot + 1) + latin.slice(dot + 1).replace(/\./g, '');
}

/** The number in a mark field, or null when it is empty or not a number. */
export function parseMarkInput(text: string): number | null {
  const s = cleanMarkInput(text);
  if (!s || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** A mark for display: whole numbers without decimals, others to at most two places. */
export function formatMark(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return String(Math.round(n * 100) / 100);
}
