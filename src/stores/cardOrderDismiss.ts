import { create } from 'zustand';

/**
 * Session-only dismissal for the homepage "no card yet" card-order banner. This is
 * an ongoing conversion prompt, NOT a first-run onboarding tip — so it is deliberately
 * in-memory (never persisted): dismissing hides it for the current app session, and a
 * later app launch surfaces it again while the student still has no card.
 */
interface CardOrderDismissState {
  dismissed: Record<string, boolean>; // keyed by scope: 'student' | 'parent'
  dismiss: (scope: string) => void;
  isDismissed: (scope: string) => boolean;
}

export const useCardOrderDismiss = create<CardOrderDismissState>((set, get) => ({
  dismissed: {},
  dismiss: (scope) => set((s) => ({ dismissed: { ...s.dismissed, [scope]: true } })),
  isDismissed: (scope) => !!get().dismissed[scope],
}));
