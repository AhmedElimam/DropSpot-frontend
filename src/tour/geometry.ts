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

/** The overlay's own place in the window — measured, never assumed to be (0, 0) at window size. */
export interface Frame { x: number; y: number; width: number; height: number }

/**
 * A target measured in window coordinates, moved into the overlay's coordinates. On Android the
 * window and the overlay disagree by the status bar, a notch or the navigation bar depending on
 * the phone (founder 2026-10-07: «doesn't spotlight the right position» on some devices);
 * measuring both the same way and subtracting cancels whatever the difference is.
 */
export function toFrame(r: TargetRect, frame: Frame): TargetRect {
  return { x: r.x - frame.x, y: r.y - frame.y, width: r.width, height: r.height };
}

/**
 * The dim as ONE path: the whole screen with the hole cut out (even-odd). It replaces an SVG
 * mask, which Android redraws in software on every frame of the glide — the slowness on
 * MediaTek Xiaomi phones (founder 2026-10-07). Same picture, a fraction of the work.
 */
export function holePath(W: number, H: number, x: number, y: number, w: number, h: number, rx: number): string {
  'worklet';
  const outer = `M0 0H${W}V${H}H0Z`;
  if (w < 1 || h < 1) return outer;
  const r = Math.max(0, Math.min(rx, w / 2, h / 2));
  return `${outer}M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/**
 * The two dim layers (the theme's overlay, then black at `extra`) as one colour, so the screen is
 * filled once instead of twice. `rgba(r,g,b,a)` in, `rgba(...)` out.
 */
export function stackDim(overlay: string, extra: number): string {
  const m = overlay.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return overlay;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a1 = m[4] === undefined ? 1 : Number(m[4]);
  // Over any background B: (B(1-a1) + C·a1)(1-e) = B(1-a) + C'·a.
  const a = 1 - (1 - a1) * (1 - extra);
  const k = (a1 * (1 - extra)) / a;
  const c = (v: number) => Math.round(v * k);
  return `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${Math.round(a * 1000) / 1000})`;
}

/**
 * How far to scroll so a target sits fully in view — below the status bar and above the tab
 * bar — or 0 when it already does. Negative scrolls up. Founder 2026-10-07: a home scrolled a
 * little, then the tour replayed, left the first stops above the screen.
 */
export function scrollNeeded(r: TargetRect, area: { height: number }, top: number, bottom: number): number {
  const MARGIN = 16;
  const minY = top + MARGIN;
  const maxY = area.height - bottom - MARGIN;
  if (r.y < minY) return r.y - minY;
  if (r.y + r.height > maxY) return Math.min(r.y - minY, r.y + r.height - maxY);
  return 0;
}
