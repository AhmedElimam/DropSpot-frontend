/**
 * الناظر صلاح الدين — the layered face (founder 2026-10-22: «you make the expressions, we're
 * going to program it»). His painted portrait is cut into layers over one base, and a mood is
 * a recipe: which layers, moved how. Every number is in a 1024-pt frame; NazerFace scales
 * them to the size it draws. Built by DrosSpot-Nazer/rig/build-rig.py; keep this in step.
 */
export const NAZER_FRAME = 1024;

/**
 * His figure on مدام روز's medallion (founder 2026-10-23, the website's look): the base is his
 * figure lifted off his old painted lattice and ring, scaled ×NAZER_RIG_SCALE about the centre
 * so his shoulders meet her ring, over her own blue. The parts were cut from the unscaled
 * painting, so NazerFace grows their places and sizes by the same factor (the website's
 * App\Support\Nazer::RIG_SCALE; the website serves the same base).
 */
export const NAZER_RIG_SCALE = 1.084746;

export type NazerLayer =
  | 'base'
  | 'brow_l'
  | 'brow_r'
  | 'mouth_smile'
  | 'mouth_flat'
  | 'mouth_half'
  | 'mouth_sad'
  | 'lid_happy_l'
  | 'lid_happy_r'
  | 'lid_blink_l'
  | 'lid_blink_r';

export type NazerMood = 'neutral' | 'stern' | 'checking' | 'proud' | 'tender' | 'sad';

/** How a layer sits in a mood: shifted (pt in the 1024 frame), turned (degrees, clockwise) and scaled, about its pivot. */
export interface NazerMove {
  dx?: number;
  dy?: number;
  rot?: number;
  scale?: number;
}

export interface NazerLayerSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  source: number;
}

// The base is a 512-px webp drawn at the frame's size; the parts keep their full-size crops.
export const NAZER_LAYERS: Record<NazerLayer, NazerLayerSpec> = {
  base: { x: 0, y: 0, w: 1024, h: 1024, source: require('../../assets/images/nazer/base.webp') },
  brow_l: { x: 355, y: 263, w: 100, h: 57, source: require('../../assets/images/nazer/brow_l.webp') },
  brow_r: { x: 502, y: 261, w: 133, h: 59, source: require('../../assets/images/nazer/brow_r.webp') },
  mouth_smile: { x: 340, y: 471, w: 272, h: 95, source: require('../../assets/images/nazer/mouth_smile.webp') },
  mouth_flat: { x: 391, y: 503, w: 169, h: 34, source: require('../../assets/images/nazer/mouth_flat.webp') },
  mouth_half: { x: 389, y: 491, w: 173, h: 48, source: require('../../assets/images/nazer/mouth_half.webp') },
  mouth_sad: { x: 393, y: 503, w: 165, h: 35, source: require('../../assets/images/nazer/mouth_sad.webp') },
  lid_happy_l: { x: 344, y: 326, w: 101, h: 67, source: require('../../assets/images/nazer/lid_happy_l.webp') },
  lid_happy_r: { x: 528, y: 322, w: 109, h: 69, source: require('../../assets/images/nazer/lid_happy_r.webp') },
  lid_blink_l: { x: 344, y: 326, w: 101, h: 67, source: require('../../assets/images/nazer/lid_blink_l.webp') },
  lid_blink_r: { x: 528, y: 322, w: 109, h: 69, source: require('../../assets/images/nazer/lid_blink_r.webp') },
};

/** The point a part turns and grows about (the brow's arch, the mouth's centre). */
export const NAZER_PIVOTS: Partial<Record<NazerLayer, [number, number]>> = {
  brow_l: [392, 282],
  brow_r: [578, 282],
  mouth_smile: [476, 516],
  mouth_flat: [476, 516],
  mouth_half: [476, 516],
  mouth_sad: [476, 516],
};

/** The moods, in draw order: eyebrows, lids, mouth. Tune numbers here, never with new pictures. */
export const NAZER_MOODS: Record<NazerMood, Partial<Record<NazerLayer, NazerMove>>> = {
  neutral: { brow_l: {}, brow_r: {}, mouth_smile: {} },
  stern: { brow_l: { dy: 20, rot: 14 }, brow_r: { dy: 20, rot: -14 }, mouth_flat: {} },
  checking: { brow_l: { dy: -20, rot: -4 }, brow_r: { dy: 6, rot: -3 }, mouth_half: {} },
  proud: { brow_l: { dy: -8 }, brow_r: { dy: -8 }, lid_happy_l: {}, lid_happy_r: {}, mouth_smile: { scale: 1.08 } },
  tender: { brow_l: { dy: -4, rot: -9 }, brow_r: { dy: -4, rot: 9 }, mouth_smile: { scale: 0.94 } },
  sad: { brow_l: { dy: -2, rot: -17 }, brow_r: { dy: -2, rot: 17 }, mouth_sad: {} },
};

/** The whole portrait in one small picture, for avatars under 56 pt and as a first paint. */
export const NAZER_PORTRAIT_160 = require('../../assets/images/nazer/portrait-160.webp');
