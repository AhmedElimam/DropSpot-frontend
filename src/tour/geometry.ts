import type { TargetRect } from './store';

/** How much the hole breathes around the element. */
export const HOLE_PAD = 8;
export const HOLE_RADIUS = 18;
/** Room kept between the hole and the label card, and the card and the screen edges. */
const GAP = 16;
const EDGE = 16;

export interface Hole { x: number; y: number; width: number; height: number; rx: number }

/** The spotlight hole around a measured element, clamped to the window. */
export function holeFor(r: TargetRect, win: { width: number; height: number }): Hole {
  // Never thinner than a fingertip, never past the window: a hole at the edge slides inwards.
  const width = Math.min(win.width - 8, Math.max(24, r.width + HOLE_PAD * 2));
  const height = Math.min(win.height - 8, Math.max(24, r.height + HOLE_PAD * 2));
  const x = Math.min(Math.max(4, r.x - HOLE_PAD), win.width - 4 - width);
  const y = Math.min(Math.max(4, r.y - HOLE_PAD), win.height - 4 - height);
  // A small round control (a tab, a chip) gets a circle-ish hole; a wide card keeps soft corners.
  const rx = Math.min(HOLE_RADIUS, Math.min(width, height) / 2);
  return { x, y, width, height, rx };
}

/**
 * Where the label card goes: below the hole when there is room, else above it. Returns the
 * card's top edge. The card is full width minus the edges, so only the vertical matters.
 */
export function placeCard(hole: Hole, cardHeight: number, win: { height: number }, insets: { top: number; bottom: number }): { top: number; below: boolean } {
  const below = hole.y + hole.height + GAP;
  if (below + cardHeight <= win.height - insets.bottom - EDGE) return { top: below, below: true };
  const above = hole.y - GAP - cardHeight;
  if (above >= insets.top + EDGE) return { top: above, below: false };
  // Neither fits (a tall card on a short phone): pin it where more room is.
  const roomBelow = win.height - (hole.y + hole.height);
  return roomBelow >= hole.y
    ? { top: Math.min(below, win.height - insets.bottom - EDGE - cardHeight), below: true }
    : { top: Math.max(insets.top + EDGE, above), below: false };
}

/** Is the element actually on screen (not scrolled away, not hidden under the tab bar)? */
export function onScreen(r: TargetRect, win: { width: number; height: number }): boolean {
  return r.y >= -4 && r.y + r.height <= win.height + 4 && r.x >= -4 && r.x + r.width <= win.width + 4;
}
