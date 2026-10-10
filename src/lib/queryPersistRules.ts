import type { Query, QueryKey } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

/**
 * What the app remembers on disk between launches, so a screen opened with no signal shows
 * the last data it had instead of a spinner or an error (founder 2026-10-09: «more offline
 * friendly»). Pure rules — the storage itself lives in queryPersist.ts.
 */

/** A query older than this is not written to disk (nor kept alive in memory for it). */
export const PERSIST_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Never written to disk:
 *  - one-time gates (survey, onboarding, the tour, «ما الجديد»): a remembered answer could
 *    pop a modal the person already dealt with on another device, until the network says no;
 *  - link-token screens and the admin's impersonation picker: tied to one moment or one session;
 *  - search: typed, throwaway.
 */
const NEVER = new Set([
  'pending-survey', 'teacher-onboarding', 'tour-status', 'release-notes',
  'invitation', 'parent-setup', 'imp-users', 'search',
]);

/**
 * «Today» data with no date in its key. Kept on disk, but only brought back on the SAME
 * calendar day it was fetched: yesterday's «حصص اليوم» must never show as today's.
 */
const DAY_RELATIVE = new Set([
  'teacher-sessions-today', 'today-feed', 'rose-sheet', 'revise-mode', 'revisions-active',
  'checkin-permissions', 'cash-reconciliation',
]);

function isDayRelative(key: QueryKey): boolean {
  if (DAY_RELATIVE.has(String(key[0]))) return true;
  if (key[0] === 'cash-collections' && key[1] === 'now') return true;
  return key[0] === 'sessions' && key[1] === 'today';
}

export function sameLocalDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Write this query to disk? Only settled, recent data the person may want back offline. */
export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state' | 'meta'>, now = Date.now()): boolean {
  if (query.state.status !== 'success') return false;
  if (query.meta?.persist === false) return false;
  if (NEVER.has(String(query.queryKey[0]))) return false;

  return now - query.state.dataUpdatedAt < PERSIST_MAX_AGE_MS;
}

/** On restore: drop the «today» queries that were fetched on another day. */
export function dropOtherDays(client: PersistedClient, now = Date.now()): PersistedClient {
  const queries = client.clientState.queries.filter(
    (q) => !isDayRelative(q.queryKey) || sameLocalDay(q.state.dataUpdatedAt, now),
  );

  return { ...client, clientState: { ...client.clientState, queries } };
}
