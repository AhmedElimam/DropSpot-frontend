import type { QueryClient } from '@tanstack/react-query';

/**
 * Empty the query cache across a session boundary WITHOUT stranding the screens that are
 * about to show.
 *
 * `queryClient.clear()` removes every query, but a mounted `useQuery` keeps pointing at
 * the query object it had. It only re-attaches to a fresh one on its next render — and a
 * screen sitting on a spinner has nothing to re-render it. Clearing a tick AFTER
 * navigating (the 2026-09-29 version) therefore caught the new screens' first requests in
 * flight and left them loading forever; pull-to-refresh "fixed" it because refetch() is
 * exactly that re-render (teacher home «حصص اليوم», founder 2026-10-01).
 *
 * So: clear SYNCHRONOUSLY, before navigating — the only observers alive are the OLD
 * screens, which are about to unmount and never render again — then sweep whatever is left
 * unobserved a little later. The sweeps exist for one race: an old screen that re-renders
 * between the clear and its unmount rebuilds its query and fetches under the NEW session,
 * polluting an id-less key («teacher-sessions-today») with the wrong person's data. Once
 * it unmounts that query has no observers, and the sweep removes it. New screens' queries
 * are observed, so the sweeps never touch them.
 */
export const SWEEP_DELAYS_MS = [500, 2500] as const;

/** Drop every query nobody is observing (the data of screens that have gone). */
export function purgeUnobserved(qc: QueryClient): number {
  const dead = qc.getQueryCache().findAll({ predicate: (q) => q.getObserversCount() === 0 });
  for (const q of dead) qc.getQueryCache().remove(q);

  return dead.length;
}

/** Clear now, then sweep. Returns a cancel for the pending sweeps. */
export function clearForSessionSwitch(qc: QueryClient, delays: readonly number[] = SWEEP_DELAYS_MS): () => void {
  qc.clear();
  const timers = delays.map((ms) => setTimeout(() => purgeUnobserved(qc), ms));

  return () => timers.forEach(clearTimeout);
}
