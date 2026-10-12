/**
 * Pure geometry for «علِّم على الخطأ» — the strokes a student or parent draws over a photo
 * of their exam paper. Everything is stored NORMALISED to the image: x and y are fractions
 * (0..1) of the image's width and height, and a stroke's width is a fraction of the image
 * WIDTH. So the drawing lands on the same spot of the paper on any screen, in a thumbnail
 * or full screen, and on the web dashboard (the server keeps exactly this JSON).
 *
 * No React here — the annotator and the viewer both build on these, and the unit test
 * (`__tests__/annotationGeometry.test.ts`) pins them down.
 */

export type Point = [number, number];

export interface Stroke {
  /** `#RRGGBB`. */
  color: string;
  /** A fraction of the image width (0.008 ≈ a pen line on a phone photo). */
  width: number;
  points: Point[];
}

export interface PhotoAnnotations {
  strokes: Stroke[];
}

/** Where an image sits inside a box, in the box's own pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Server limits (StudentComplaintService): at most 60 strokes, 3000 points each. */
export const MAX_STROKES = 60;
export const MAX_POINTS = 3000;
/** The `annotations` field is a string capped at 300,000 characters; stay well inside it. */
export const MAX_JSON_LENGTH = 280_000;
/** The default pen: about a felt-tip line on a phone photo of an A4 page. */
export const DEFAULT_STROKE_WIDTH = 0.008;

const HEX = /^#[0-9A-Fa-f]{6}$/;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const round = (v: number, places = 3) => {
  const f = 10 ** places;
  return Math.round(v * f) / f;
};

/**
 * The rect an image of `imageW × imageH` occupies when fitted («contain») and centred in a
 * `boxW × boxH` box — the letterboxing every photo gets on a screen of another shape.
 */
export function containRect(imageW: number, imageH: number, boxW: number, boxH: number): Rect {
  if (!(imageW > 0) || !(imageH > 0) || !(boxW > 0) || !(boxH > 0)) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.min(boxW / imageW, boxH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}

/**
 * A touch at (x, y) — in the coordinates of the view that holds the rect — as a point on
 * the image (0..1). A finger sliding past the edge stays on the edge.
 */
export function normalisePoint(x: number, y: number, rect: Rect): Point {
  if (!(rect.width > 0) || !(rect.height > 0)) return [0, 0];
  return [clamp01((x - rect.x) / rect.width), clamp01((y - rect.y) / rect.height)];
}

/** The inverse: a stored point back to pixels inside the view that holds `rect`. */
export function denormalisePoint(p: Point, rect: Rect): { x: number; y: number } {
  return { x: rect.x + p[0] * rect.width, y: rect.y + p[1] * rect.height };
}

/** A stroke's width in pixels for an image drawn `rect.width` wide (never thinner than 1px). */
export function strokeWidthPx(width: number, rect: Rect): number {
  return Math.max(1, width * rect.width);
}

/**
 * The SVG path for a stroke drawn in `rect`. A single tap becomes a zero-length segment so
 * the round line cap paints it as a dot.
 */
export function strokePath(points: Point[], rect: Rect): string {
  if (!points.length) return '';
  const px = points.map((p) => denormalisePoint(p, rect));
  const f = (v: number) => String(Math.round(v * 10) / 10);
  if (px.length === 1) return `M${f(px[0].x)} ${f(px[0].y)} L${f(px[0].x)} ${f(px[0].y)}`;
  return px.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ');
}

/**
 * Adds a point to the stroke being drawn — skipping one that barely moved (a still finger
 * fires many moves) and stopping at the server's point limit. Returns the same array when
 * nothing was added, so a caller can skip a re-render.
 */
export function appendPoint(points: Point[], p: Point, minDistance = 0.002): Point[] {
  if (points.length >= MAX_POINTS) return points;
  const last = points[points.length - 1];
  if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < minDistance) return points;
  return [...points, p];
}

/**
 * Reads annotations from the server (an object, or the JSON string the family sent) and
 * keeps only what can be drawn: valid colours, positive widths, in-range points.
 * Anything unreadable is `null` — the photo is still shown, just without marks.
 */
export function parseAnnotations(raw: unknown): PhotoAnnotations | null {
  let v: any = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return null; }
  }
  if (!v || typeof v !== 'object' || !Array.isArray(v.strokes)) return null;
  const strokes: Stroke[] = [];
  for (const s of v.strokes.slice(0, MAX_STROKES)) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.points)) continue;
    const color = typeof s.color === 'string' && HEX.test(s.color) ? s.color : '#E53935';
    const width = typeof s.width === 'number' && s.width > 0 && s.width <= 0.2 ? s.width : DEFAULT_STROKE_WIDTH;
    const points: Point[] = [];
    for (const p of s.points.slice(0, MAX_POINTS)) {
      if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
        points.push([clamp01(p[0]), clamp01(p[1])]);
      }
    }
    if (points.length) strokes.push({ color, width, points });
  }
  return { strokes };
}

/** Halves a stroke's points, keeping its first and last so the line still starts and ends right. */
function thin(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const out = points.filter((_, i) => i % 2 === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/**
 * The JSON string sent as `annotations`: points rounded to 3 places (a thousandth of the
 * image — finer than a finger), limits enforced, and long drawings thinned until the
 * whole thing fits the server's field. `null` when there is nothing drawn.
 */
export function serialiseAnnotations(a: PhotoAnnotations | null | undefined): string | null {
  if (!a) return null;
  let strokes: Stroke[] = a.strokes
    .slice(0, MAX_STROKES)
    .map((s) => ({
      color: HEX.test(s.color) ? s.color.toUpperCase() : '#E53935',
      width: round(s.width > 0 ? s.width : DEFAULT_STROKE_WIDTH, 4),
      points: s.points.slice(0, MAX_POINTS).map((p): Point => [round(clamp01(p[0])), round(clamp01(p[1]))]),
    }))
    .filter((s) => s.points.length > 0);
  if (!strokes.length) return null;
  let json = JSON.stringify({ strokes });
  for (let i = 0; json.length > MAX_JSON_LENGTH && i < 8; i++) {
    strokes = strokes.map((s) => ({ ...s, points: thin(s.points) }));
    json = JSON.stringify({ strokes });
  }
  return json;
}

// ── shapes (founder 2026-10-06: «the edit UI needs a little enhancing») ──────────────────
// A circle around an answer and an arrow to a question are what people actually draw on a
// paper. Both are stored as ordinary strokes — a list of points — so the server, the web
// dashboard and every viewer draw them with no change at all.

/** Pen thicknesses, as fractions of the image width (inside the server's 0.002–0.05). */
export const STROKE_WIDTHS = [0.005, DEFAULT_STROKE_WIDTH, 0.014] as const;

/** A drag shorter than this (a fraction of the image) is a slip, not a shape. */
export const MIN_SHAPE = 0.015;

/**
 * The ellipse inside the box a drag from `a` to `b` spans, as a closed run of points.
 * Drawn in image fractions: on a non-square photo it is the oval that fills that box,
 * exactly what the finger outlined on screen.
 */
export function ellipsePoints(a: Point, b: Point, segments = 48): Point[] {
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  const rx = Math.abs(b[0] - a[0]) / 2;
  const ry = Math.abs(b[1] - a[1]) / 2;
  const out: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    out.push([clamp01(round(cx + rx * Math.cos(t), 4)), clamp01(round(cy + ry * Math.sin(t), 4))]);
  }
  return out;
}

/**
 * An arrow from `a` to `b`: the shaft, then the two sides of the head, as ONE run of points
 * (shaft → tip → one barb, back to the tip → the other barb). `aspect` is the image's
 * width / height, so the head keeps its angle on a tall photo. The head is about a fifth of
 * the shaft, within sensible bounds.
 */
export function arrowPoints(a: Point, b: Point, aspect: number): Point[] {
  const k = aspect > 0 ? aspect : 1;
  // Work in a space where one unit is the same length across and down (x scaled by aspect).
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1];
  const len = Math.hypot(bx - ax, by - ay);
  if (len === 0) return [a, b];
  const head = Math.min(Math.max(len * 0.22, 0.025), 0.09);
  const angle = Math.atan2(by - ay, bx - ax);
  const spread = Math.PI / 7;
  const barb = (sign: number): Point => {
    const t = angle + Math.PI + sign * spread;
    return [clamp01(round((bx + head * Math.cos(t)) / k, 4)), clamp01(round(by + head * Math.sin(t), 4))];
  };
  return [a, b, barb(1), b, barb(-1)];
}

/** Whether a drag from `a` to `b` is long enough to be a shape. */
export function isShape(a: Point, b: Point): boolean {
  return Math.hypot(b[0] - a[0], b[1] - a[1]) >= MIN_SHAPE;
}
