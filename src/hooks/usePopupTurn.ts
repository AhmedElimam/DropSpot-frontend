import { create } from 'zustand';
import { useTeacherOnboarding } from '@/hooks/useTeacherOnboarding';

/**
 * Whether the brand-new teacher's «مرحبًا بك» popup (TeacherOnboardingModal) is up or still
 * deciding: a popup that comes after it waits — two native modals presented at the same
 * moment on iOS leave one of them invisible over the screen, swallowing every tap (caught
 * 2026-10-25 on a fresh login: the welcome and مدام روز's unlock raced).
 */
export function useOnboardingIntroPending(): boolean {
  const { data, isLoading } = useTeacherOnboarding();
  if (isLoading) return true;
  return !!data && data.active && !data.steps.intro && !data.has_courses;
}

/**
 * Popups still to come (or up) at app open, in their order: مدام روز's unlock, then her
 * subscription status. Published by each modal, read by the one after it and by the
 * spotlight tour, which starts only once both are done. Unknown counts as to come.
 */
export const useRoseUnlockGate = create<{ pending: boolean }>(() => ({ pending: true }));
export const useStatusPopupGate = create<{ pending: boolean }>(() => ({ pending: false }));
