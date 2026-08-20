/**
 * Arabic-Indic numeral display.
 *
 * The app is Arabic-first, so numbers should READ in Arabic-Indic digits
 * (٠-٩). Dates and currency already do (via `toLocaleString('ar-EG')`); this is
 * the one place that converts the everything-else — percentages, durations,
 * relative time, counts, and every i18next `{{count}}` interpolation.
 *
 * DISPLAY ONLY. Never run this over a value the user must type back (phone,
 * OTP, invite code, an amount input) or over anything you will parse afterwards
 * — those must stay Western ASCII digits. That is why the i18next hook converts
 * `number` values only and leaves interpolated strings (codes, ids) untouched.
 */
const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/** Replace the ASCII digits in `value` with Arabic-Indic digits, for display. */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}
