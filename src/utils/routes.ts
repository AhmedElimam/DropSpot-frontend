import type { Href } from 'expo-router';

/**
 * The one address for «send me where my role lives» — app/resolve.tsx, the same screen as
 * the root index (gates, then the role's tabs).
 *
 * NEVER navigate to `'/'` from inside the app. Route groups are invisible in URLs, so `/`
 * matches `app/index.tsx` AND `app/(teacher)/index.tsx` (and the student's and parent's):
 * from inside the teacher tabs Expo Router resolved `/` to the teacher HOME TAB, the layout
 * that had just redirected there saw the wrong role again and redirected again — the
 * infinite «[route] (teacher) → / for role admin» loop on leaving impersonation (founder
 * 2026-10-02). `/resolve` has no twin in any group, so it always means the root router.
 */
export const ROUTE_BY_ROLE: Href = '/resolve' as Href;
