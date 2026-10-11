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
