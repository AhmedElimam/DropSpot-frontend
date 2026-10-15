/**
 * The geometry of the outro's crest frame — Madam Rose's portrait frame (founder 2026-10-15:
 * «the same crest border, the Greek look we put on Madam Rose's border»): a navy disc inside a
 * gold double ring, two laurel branches sweeping up both sides toward the top, the DS medallion
 * on the ring's top. Pure numbers and SVG path strings so the drawing is testable and every
 * frame of the animation reuses them (nothing is computed per frame).
 *
 * Angles are measured from 12 o'clock, clockwise (screen y grows downward): θ = 0 is the top,
 * 90 the right, 180 the bottom, 270 the left.
 */

export const CREST_GOLD = '#C9A227';
export const CREST_GOLD_LIGHT = '#F3D98B';
export const CREST_GOLD_DEEP = '#8E6E10';
export const CREST_NAVY = '#26318A';
export const CREST_NAVY_DEEP = '#0D1338';

/** Laurel stations per side: the leaves pop in pair by pair, bottom to top. */
export const LAUREL_STATIONS = 7;

export interface LeafStation {
  /** Centre of the station's box (the point on the stem), left branch. */
  x: number;
  y: number;
  /** The stem's upward direction there, degrees from «up», clockwise (left branch). */
  tangent: number;
}

export interface CrestGeometry {
  size: number;
  c: number;
  /** The gold ring's radius (stroke centre). */
  ring: number;
  ringStroke: number;
  /** The fine inner ring. */
  inner: number;
  /** The navy disc (fills up to the ring). */
  disc: number;
  /** The laurel stem's radius. */
  stem: number;
  leaf: { length: number; width: number; box: number };
  /** Ring halves from the bottom up to the top — left and right — and their length. */
  ringLeft: string;
  ringRight: string;
  innerLeft: string;
  innerRight: string;
  ringHalf: number;
  innerHalf: number;
  stemLeft: string;
  stemRight: string;
  stemLength: number;
  /** Left-branch stations, bottom to top; the right branch is their mirror (x → size − x, angle → −angle). */
  stations: LeafStation[];
  medallion: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The point at angle θ (from the top, clockwise) on a circle of radius r around (c, c). */
export function polar(c: number, r: number, theta: number): { x: number; y: number } {
  return { x: c + r * Math.sin(rad(theta)), y: c - r * Math.cos(rad(theta)) };
}

/** Where the laurel starts (lower left) and ends (just short of the medallion), left branch. */
export const STEM_FROM = 206;
export const STEM_TO = 336;

export function crestGeometry(size: number): CrestGeometry {
  const c = size / 2;
  const ring = size * 0.36;
  const ringStroke = Math.max(3, size * 0.017);
  const inner = ring - ringStroke - size * 0.014;
  const stem = ring + size * 0.045;
  const length = size * 0.068;
  const width = length * 0.4;
  const box = Math.ceil(length * 2 + 6);

  const top = polar(c, ring, 0);
  const bottom = polar(c, ring, 180);
  const iTop = polar(c, inner, 0);
  const iBottom = polar(c, inner, 180);
  // From the bottom: up the left side is clockwise (sweep 1), up the right is anticlockwise (0).
  const ringLeft = `M ${r2(bottom.x)} ${r2(bottom.y)} A ${r2(ring)} ${r2(ring)} 0 0 1 ${r2(top.x)} ${r2(top.y)}`;
  const ringRight = `M ${r2(bottom.x)} ${r2(bottom.y)} A ${r2(ring)} ${r2(ring)} 0 0 0 ${r2(top.x)} ${r2(top.y)}`;
  const innerLeft = `M ${r2(iBottom.x)} ${r2(iBottom.y)} A ${r2(inner)} ${r2(inner)} 0 0 1 ${r2(iTop.x)} ${r2(iTop.y)}`;
  const innerRight = `M ${r2(iBottom.x)} ${r2(iBottom.y)} A ${r2(inner)} ${r2(inner)} 0 0 0 ${r2(iTop.x)} ${r2(iTop.y)}`;

  const s0 = polar(c, stem, STEM_FROM);
  const s1 = polar(c, stem, STEM_TO);
  const stemLeft = `M ${r2(s0.x)} ${r2(s0.y)} A ${r2(stem)} ${r2(stem)} 0 0 1 ${r2(s1.x)} ${r2(s1.y)}`;
  const stemRight = `M ${r2(size - s0.x)} ${r2(s0.y)} A ${r2(stem)} ${r2(stem)} 0 0 0 ${r2(size - s1.x)} ${r2(s1.y)}`;

  const step = (STEM_TO - STEM_FROM) / LAUREL_STATIONS;
  const stations: LeafStation[] = [];
  for (let k = 0; k < LAUREL_STATIONS; k++) {
    const theta = STEM_FROM + step * (k + 0.5);
    const p = polar(c, stem, theta);
    // Moving clockwise along the left side, the direction «up the stem» is θ − 270 from up.
    stations.push({ x: r2(p.x), y: r2(p.y), tangent: r2(theta - 270) });
  }

  return {
    size, c, ring, ringStroke, inner, disc: ring - ringStroke / 2, stem,
    leaf: { length, width, box },
    ringLeft, ringRight, innerLeft, innerRight,
    ringHalf: Math.PI * ring, innerHalf: Math.PI * inner,
    stemLeft, stemRight, stemLength: stem * rad(STEM_TO - STEM_FROM),
    stations,
    medallion: Math.round(size * 0.2),
  };
}

/**
 * One leaf drawn from the centre of a `box`-sized square, pointing up before its rotation:
 * a pointed oval (two quadratic sides) — the olive leaf of the stamp's branches.
 */
export function leafPath(box: number, length: number, width: number): string {
  const c = box / 2;
  return `M ${r2(c)} ${r2(c)} Q ${r2(c + width)} ${r2(c - length * 0.45)} ${r2(c)} ${r2(c - length)} Q ${r2(c - width)} ${r2(c - length * 0.45)} ${r2(c)} ${r2(c)} Z`;
}

/** How far a station's two leaves open from the stem, degrees. */
export const LEAF_SPREAD = 40;
