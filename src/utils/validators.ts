import { useAppConfigStore } from '@/stores/appConfigStore';
import type { UiValidationRule } from '@/config/defaults';

/**
 * Client-side validators that MIRROR the server rules, so bad input is caught inline
 * (before submit) with the same meaning the backend enforces.
 *
 * Since 2026-10-11 the rules come from BACKEND CODE (server config/mobile_ui.php →
 * `ui.validation`, read at call time from the cached config); the constants below are the
 * bundled fallback and must match the server's defaults.
 */

// Matches App\Rules\ArabicName — Arabic letters (+ tatweel) and spaces only.
const ARABIC_NAME_RE = /^[ء-يـ\s]+$/;

// Egyptian mobile — the same /^01[0-9]{9}$/ the invite/booking endpoints use.
const EGYPT_PHONE_RE = /^01[0-9]{9}$/;

function rule(name: string): UiValidationRule | undefined {
  return useAppConfigStore.getState().config.ui?.validation?.[name];
}

/** The backend's pattern when it has one and compiles; else the bundled regex. */
function pattern(name: string, fallback: RegExp): RegExp {
  const src = rule(name)?.pattern;
  if (!src) return fallback;
  try { return new RegExp(src, 'u'); } catch { return fallback; }
}

/** The inline wording the backend chose for a rule, if any (screens keep their own otherwise). */
export function validationMessage(name: string): string | undefined {
  return rule(name)?.message || undefined;
}

/** True when the (non-empty) name is Arabic-only. Empty strings are treated as valid (optional fields). */
export function isArabicName(value: string): boolean {
  const v = value.trim();
  return v === '' || pattern('arabic_name', ARABIC_NAME_RE).test(v);
}

/** True when the value is a full Egyptian mobile number. Empty is valid (optional fields). */
export function isEgyptPhone(value: string): boolean {
  const v = value.trim();
  return v === '' || pattern('egypt_phone', EGYPT_PHONE_RE).test(v);
}

/** A name is a "triple" name when it has at least three whitespace-separated parts (the backend may ask for fewer or more). */
export function isTripleName(value: string): boolean {
  const min = rule('triple_name')?.min_words ?? 3;
  return value.trim().split(/\s+/).filter(Boolean).length >= min;
}

/**
 * An Egyptian mobile as people type it → «01XXXXXXXXX», or null when it is not one. Mirrors the
 * server's App\Support\EgyptPhone (fast register v2, founder 2026-11-06): Arabic-Indic and
 * Persian digits become Latin, everything else that is not a digit goes, +20 / 0020 / a bare
 * 20… become the leading 0, and the result must be 01[0125] + 8 digits.
 */
export function normalizeEgyptPhone(raw: string): string | null {
  let d = raw
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/\D+/g, '');
  if (d.startsWith('0020')) d = '0' + d.slice(4);
  else if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2);
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}

/**
 * A name as typed at the door → as the server stores it (App\Rules\ArabicName::clean): تشكيل
 * dropped, spaces folded, a hyphen kept tight. Digits and Latin stay, so the check still refuses them.
 */
export function cleanDoorName(raw: string): string {
  return raw
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[‐‑–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^-+|-+$/g, '');
}

/** The door's name rule: Arabic letters, tatweel, spaces and a hyphen (after {@link cleanDoorName}). */
export function isDoorName(value: string): boolean {
  const v = cleanDoorName(value);
  return v !== '' && /^[ء-يـ\s-]+$/.test(v);
}
