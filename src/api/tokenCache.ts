/**
 * The access token, held in memory once read.
 *
 * Every request used to call SecureStore for the token — on Android that is a Keystore
 * decryption per call, tens of milliseconds of CPU on a Snapdragon 680, paid again for
 * each of the several requests a screen fires (founder 2026-09-22: "slowness of the app",
 * Play Console: performance issues). The keystore stays the durable copy; this is the
 * copy the request path reads. `undefined` = not loaded yet, `null` = signed out.
 *
 * Lives in its own module so both the auth store (which writes tokens) and the API
 * client (which reads them) can import it without importing each other.
 */
let cached: string | null | undefined = undefined;

export function getCachedAccessToken(): string | null | undefined {
  return cached;
}

/** Call wherever the stored token changes — login, refresh, impersonation, logout. */
export function setCachedAccessToken(token: string | null): void {
  cached = token;
}
