import { create } from 'zustand';

/**
 * Which reaction picker is open, app-wide: at most one (founder 2026-11-13: «I opened the
 * reactions by mistake and scrolled, it doesn't dismiss unless I tap react»). Opening one closes
 * any other; the shared list wrapper (src/components/ui/Refreshable.tsx) closes it on a scroll and
 * on a touch that lands anywhere but the picker or the button that opened it.
 *
 * How «anywhere but» is told apart without claiming any touch: a touch event bubbles from the
 * view under the finger up to the list, so the picker (and its button) note the event's timestamp
 * first, and the list's own handler skips that one event.
 */
export const useReactionPicker = create<{ open: string | null }>(() => ({ open: null }));

export function openReactionPicker(key: string): void {
  useReactionPicker.setState({ open: key });
}

export function closeReactionPicker(): void {
  if (useReactionPicker.getState().open !== null) useReactionPicker.setState({ open: null });
}

let insideStamp: number | null = null;

type TouchLike = { nativeEvent: { timestamp?: number } };

/** On the picker and its button: this touch is theirs, the list must not close the picker for it. */
export function markReactionPickerTouch(e: TouchLike): void {
  insideStamp = e.nativeEvent.timestamp ?? null;
}

/** On the list: a touch that began outside the picker closes it. */
export function reactionPickerOutsideTouch(e: TouchLike): void {
  if (useReactionPicker.getState().open === null) return;
  const stamp = e.nativeEvent.timestamp;
  if (stamp != null && stamp === insideStamp) return;
  closeReactionPicker();
}

/** Tests only. */
export function __resetReactionPickerForTests(): void {
  insideStamp = null;
  useReactionPicker.setState({ open: null });
}
