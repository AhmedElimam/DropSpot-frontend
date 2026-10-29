import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * ONE popup on screen at a time (founder 2026-10-25: «make sure the popups don't collide and
 * freeze the app»). iOS presents a native modal only while no other one is presenting or
 * dismissing; two asked for in the same moment leave one of them invisible over the screen,
 * swallowing every tap — a fresh login froze on the welcome and مدام روز's unlock.
 *
 * Every app-wide popup asks for the slot with `usePopupSlot(id, wants)` and shows only while it
 * holds it. The slot goes to the first in ORDER that wants it, never takes it from the one
 * showing, waits GAP_MS after any modal closed, and never opens over a sheet or a modal a screen
 * already has up (AppModal and SheetModal report themselves through `useModalPresence`).
 */
export const POPUP_ORDER = [
  // «وضع المراجعة مفعّل الآن»: the person just flipped the season, so its sheet goes first
  // (2026-10-28: it opened beside مدام روز's unlock after the rebuild and the app froze).
  'revision_welcome',
  // «اتوقفت مشاركتك في المجتمع» — the member's own pause, once per suspension (2026-10-29).
  'community_pause',
  'onboarding_intro',
  // A feature's add-on agreement (chat, حكاوي, مجتمعنا…): one at a time, the next after a gap.
  'feature_terms',
  'whats_new',
  'nazer_unlock',
  // The student's lock until the parent's number is proved (2026-10-26): straight after الناظر.
  'parent_number_check',
  'rose_unlock',
  'subscription_status',
  // A survey comes after the app's own intro (founder 2026-10-26: «nazer intro doesn't show any
  // more because survey's on»); SurveyModal also waits out الناظر and the first tour.
  'survey',
] as const;
export type PopupId = (typeof POPUP_ORDER)[number];

/** The breath between one modal's dismissal and the next presentation. */
export const GAP_MS = 650;

/** A free slot waits this long after a first ask, so popups asking together go in ORDER, not by who asked first. */
export const GATHER_MS = 400;

interface SlotState {
  wants: Partial<Record<PopupId, boolean>>;
  holder: PopupId | null;
  /** Modals up that are not the holder's: a screen's sheet, a confirm, another popup. */
  others: number;
  freeAt: number;
}

export const usePopupSlotStore = create<SlotState>(() => ({ wants: {}, holder: null, others: 0, freeAt: 0 }));

let timer: ReturnType<typeof setTimeout> | null = null;

/** Decide who holds the slot now; re-run when the gap ends. */
function arbitrate(): void {
  const s = usePopupSlotStore.getState();
  if (s.holder) {
    if (s.wants[s.holder]) return;
    // The holder is done: free the slot after the gap.
    usePopupSlotStore.setState({ holder: null, freeAt: Date.now() + GAP_MS });
    schedule(GAP_MS);
    return;
  }
  if (s.others > 0) return; // re-run when it closes
  const wait = s.freeAt - Date.now();
  if (wait > 0) { schedule(wait); return; }
  const next = POPUP_ORDER.find((id) => s.wants[id]) ?? null;
  if (next) usePopupSlotStore.setState({ holder: next });
}

function schedule(ms: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; arbitrate(); }, ms + 10);
}

/** A popup wants the slot, or no longer does (exported for tests; components use usePopupSlot). */
export function setWant(id: PopupId, want: boolean): void {
  const s = usePopupSlotStore.getState();
  if (!!s.wants[id] === want) return;
  const idle = want && !s.holder && !POPUP_ORDER.some((p) => s.wants[p]);
  usePopupSlotStore.setState({
    wants: { ...s.wants, [id]: want },
    ...(idle ? { freeAt: Math.max(s.freeAt, Date.now() + GATHER_MS) } : {}),
  });
  arbitrate();
}

/** Whether this popup may show now. `wants` is everything it waits for on its own. */
export function usePopupSlot(id: PopupId, wants: boolean): boolean {
  useEffect(() => {
    setWant(id, wants);
  }, [id, wants]);
  useEffect(() => () => setWant(id, false), [id]);
  const holder = usePopupSlotStore((s) => s.holder);
  return wants && holder === id;
}

/** Any popup showing or waiting — the spotlight tour starts only once the queue is empty. */
export function usePopupQueueBusy(): boolean {
  return usePopupSlotStore((s) => s.holder !== null || POPUP_ORDER.some((id) => s.wants[id]));
}

/**
 * Called by every modal shell (AppModal, SheetModal) with its visibility. The holder's own
 * modal counts too, harmlessly: the count is read only while nobody holds the slot. Anything
 * else that covers the app and rebuilds under it (the season's curtain) reports itself the
 * same way, so no popup presents while it is up.
 */
export function useModalPresence(visible: boolean): void {
  useEffect(() => {
    if (!visible) return;
    modalOpened();
    return modalClosed;
  }, [visible]);
}

export function modalOpened(): void {
  usePopupSlotStore.setState((s) => ({ others: s.others + 1 }));
}

/** A modal closed: the next popup waits the gap, so it never presents on the dismissal. */
export function modalClosed(): void {
  usePopupSlotStore.setState((s) => ({ others: Math.max(0, s.others - 1), freeAt: Math.max(s.freeAt, Date.now() + GAP_MS) }));
  schedule(GAP_MS);
}

/** Test hook. */
export function resetPopupSlot(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  usePopupSlotStore.setState({ wants: {}, holder: null, others: 0, freeAt: 0 });
}
