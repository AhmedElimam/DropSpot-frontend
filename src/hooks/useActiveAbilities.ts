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
} as const;

export function useActiveAbilities() {
  const role = useAuthStore((s) => s.role);
  const { data } = useMyTeachers();
  const isAssistant = role === 'assistant';
  const active = data?.teachers.find((x) => x.is_active_context);
  const abilities = active?.abilities ?? [];

  return {
    isAssistant,
    abilities,
    can: (ability: string) => !isAssistant || abilities.includes(ability),
  };
}
