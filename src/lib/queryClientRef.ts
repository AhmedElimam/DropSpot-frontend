import type { QueryClient } from '@tanstack/react-query';

/**
 * The app's one QueryClient, reachable from non-React code (the offline sync runs from a
 * NetInfo listener and needs to refresh a session after replaying its marks). Set once by
 * the root layout; null until then, so callers must tolerate its absence.
 */
let ref: QueryClient | null = null;

export function setQueryClient(qc: QueryClient): void {
  ref = qc;
}

export function getQueryClient(): QueryClient | null {
  return ref;
}
