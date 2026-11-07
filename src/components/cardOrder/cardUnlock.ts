import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getCardOrderTargets, type CardOrderTarget } from '@/api/cardOrders';

/**
 * The Dros Spot card is a level-up (founder 2026-11-07): a child with one teacher on Dros Spot
 * never sees it offered; at a second teacher it unlocks — الناظر's «عنصر جديد» popup, then the
 * order button on the profile, the card page and the home banner. A server without
 * `teacher_count` reads as locked.
 */
export const CARD_UNLOCK_TEACHERS = 2;

export const isCardUnlocked = (t: Pick<CardOrderTarget, 'teacher_count'>) => (t.teacher_count ?? 0) >= CARD_UNLOCK_TEACHERS;

/** The family's card targets, split into unlocked and orderable (unlocked, no order in flight). */
export function useCardUnlock() {
  const role = useAuthStore((s) => s.role);
  const family = role === 'student' || role === 'parent';
  const { data, isSuccess } = useQuery({ queryKey: ['card-order-targets'], queryFn: getCardOrderTargets, enabled: family, staleTime: 60_000 });
  const targets = data ?? [];
  const unlocked = targets.filter(isCardUnlocked);
  const orderable = unlocked.filter((t) => t.can_order && !t.pending_review);
  return { family, loaded: isSuccess, targets, unlocked, orderable };
}
