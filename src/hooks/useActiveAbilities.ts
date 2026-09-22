import { useCallback, useMemo } from 'react';
import { useMyTeachers } from '@/hooks/useMyTeachers';
import { useAuthStore } from '@/stores/authStore';

/**
 * The abilities in effect for the CURRENT context, re-evaluated on every teacher
 * switch (useMyTeachers is invalidated on switch, so this re-reads automatically).
 *
 * - A plain teacher can do everything (`can` is always true).
 * - An assistant can only do what the ACTIVE teacher granted them.
 *
 * Financial features are never gated through `can` — they are hard-blocked for
 * assistants regardless of ability config (see `isAssistant`).
 */
export const ABILITY = {
  SCAN: 'scan_attendance',
  MARK_MANUAL: 'mark_attendance_manual',
  REPLY_TICKETS: 'reply_tickets',
  MANAGE_STUDENTS: 'manage_students',
  MANAGE_SESSIONS: 'manage_sessions',
  MANAGE_COURSES: 'manage_courses',
  REVIEW_PAYMENT_PROOFS: 'review_payment_proofs',
  ISSUE_GUEST_PASSES: 'issue_guest_passes',
  /** File a student incident report to the platform admins (teacher's tenant, assistant recorded). */
  REPORT_INCIDENTS: 'report_incidents',
} as const;

// The returned object and its `can` function are memoised. They used to be rebuilt on
// every render, and because this hook is consumed by the busiest teacher screens (home,
// scanner, roster, manage) that fresh identity propagated into their children and
// defeated every downstream memo — a re-render of the whole subtree on any state change.
// `abilities` is also stabilised: `?? []` allocated a new empty array each time.
const NO_ABILITIES: readonly string[] = [];

export function useActiveAbilities() {
  const role = useAuthStore((s) => s.role);
  const { data } = useMyTeachers();
  const isAssistant = role === 'assistant';
  const active = data?.teachers.find((x) => x.is_active_context);
  const abilities = active?.abilities ?? NO_ABILITIES;

  const can = useCallback(
    (ability: string) => !isAssistant || abilities.includes(ability),
    [isAssistant, abilities],
  );

  return useMemo(() => ({ isAssistant, abilities, can }), [isAssistant, abilities, can]);
}
