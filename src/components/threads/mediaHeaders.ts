import { useEffect, useSyncExternalStore } from 'react';
import { attachmentHeaders } from '@/api/chat';
import { STAGING_HEADER, STAGING_KEY } from '@/config/env';

/**
 * Headers a حكاوي media fetch needs (founder 2026-10-15: «video doesn't work»).
 *
 * The native players and image loaders fetch outside axios, so nothing adds the client's
 * headers for them:
 *  - the STREAM url (`/threads/stream/{token}`) is authorised by its token, but on a staging
 *    build every request must also carry the staging door key — without it stg answers 404,
 *    which is exactly "uploaded fine, never plays";
 *  - the POSTER url (`/threads/videos/{id}/poster`) is an ordinary API route: bearer token
 *    (and the door key on staging). Without them no poster ever showed, production included.
 */

/** For the stream: only the door key — the token in the URL is the authorisation. */
export const STREAM_HEADERS: Record<string, string> | undefined = STAGING_KEY ? { [STAGING_HEADER]: STAGING_KEY } : undefined;

// The poster headers, read from the keystore ONCE and shared by every card in a list (each
// card awaiting SecureStore on mount would be a keystore read per row). Re-read after a few
// minutes so a rotated access token is picked up.
const TTL_MS = 3 * 60_000;
let cached: Record<string, string> | null = null;
let cachedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function refresh(): void {
  if (inflight) return;
  inflight = attachmentHeaders()
    .then((h) => {
      cached = h;
      cachedAt = Date.now();
      listeners.forEach((l) => l());
    })
    .catch(() => {})
    .finally(() => { inflight = null; });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const snapshot = () => cached;

/** Bearer + door key for an authenticated media URL; null for the first moment after launch. */
export function useMediaHeaders(): Record<string, string> | null {
  const headers = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!cached || Date.now() - cachedAt > TTL_MS) refresh();
  }, []);
  return headers;
}
