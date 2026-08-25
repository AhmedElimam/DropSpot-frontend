/**
 * Client-side validators that MIRROR the server rules, so bad input is caught inline
 * (before submit) with the same meaning the backend enforces.
 */

// Matches App\Rules\ArabicName — Arabic letters (+ tatweel) and spaces only.
const ARABIC_NAME_RE = /^[ء-يـ\s]+$/;

// Egyptian mobile — the same /^01[0-9]{9}$/ the invite/booking endpoints use.
const EGYPT_PHONE_RE = /^01[0-9]{9}$/;

/** True when the (non-empty) name is Arabic-only. Empty strings are treated as valid (optional fields). */
export function isArabicName(value: string): boolean {
  const v = value.trim();
  return v === '' || ARABIC_NAME_RE.test(v);
}

/** True when the value is a full Egyptian mobile number. Empty is valid (optional fields). */
export function isEgyptPhone(value: string): boolean {
  const v = value.trim();
  return v === '' || EGYPT_PHONE_RE.test(v);
}

/** A name is a "triple" name when it has at least three whitespace-separated parts. */
export function isTripleName(value: string): boolean {
  return value.trim().split(/\s+/).filter(Boolean).length >= 3;
}
