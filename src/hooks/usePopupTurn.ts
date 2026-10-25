import { useEffect, useState } from 'react';
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
 * True once `free` has held for `ms` — the breath a popup leaves after the one before it
 * closed, so its own presentation never lands on the other's dismissal.
 */
export function useSettled(free: boolean, ms = 650): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!free) { setSettled(false); return; }
    const t = setTimeout(() => setSettled(true), ms);
    return () => clearTimeout(t);
  }, [free, ms]);
  return free && settled;
}

/**
 * Popups still to come (or up) at app open, in their order: مدام روز's unlock, then her
 * subscription status. Published by each modal, read by the one after it and by the
 * spotlight tour, which starts only once both are done. Unknown counts as to come.
 */
export const useRoseUnlockGate = create<{ pending: boolean }>(() => ({ pending: true }));
export const useStatusPopupGate = create<{ pending: boolean }>(() => ({ pending: false }));
