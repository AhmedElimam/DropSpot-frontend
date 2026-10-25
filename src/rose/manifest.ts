/**
 * مدام روز's rig (founder 2026-10-25: «she doesn't move or make reaction or moving her lips
 * when she talks any more»). Her painted portrait, cut like الناظر's: one base with skin under
 * the parts, and the parts — her own brows, eyes and lips — as layers RoseLive moves. Every
 * box is in the 1200-pt frame of the framed medallion (the 600 px picture is that frame at
 * half size). Built by the session's rose2/rig.py; keep this in step with its manifest.json.
 */
export const ROSE_FRAME = 1200;

export type RoseLayer = 'brow_l' | 'brow_r' | 'eye_l' | 'eye_r' | 'lips';

/** x, y, w, h in the frame, and the pivot (fraction of the box) the part turns and scales about. */
export const ROSE_RIG: Record<RoseLayer, { box: [number, number, number, number]; pivot: [number, number]; source: number }> = {
  brow_l: { box: [486.1, 514.8, 100.3, 43.3], pivot: [0.5, 0.6], source: require('../../assets/images/rose/rig/brow_l.webp') },
  brow_r: { box: [620.6, 514.8, 111.7, 45.6], pivot: [0.5, 0.6], source: require('../../assets/images/rose/rig/brow_r.webp') },
  eye_l: { box: [502.0, 555.8, 84.4, 50.2], pivot: [0.5, 0.6], source: require('../../assets/images/rose/rig/eye_l.webp') },
  eye_r: { box: [622.9, 555.8, 91.2, 52.4], pivot: [0.5, 0.6], source: require('../../assets/images/rose/rig/eye_r.webp') },
  lips: { box: [540.8, 663.0, 143.6, 63.8], pivot: [0.5, 0.15], source: require('../../assets/images/rose/rig/lips.webp') },
};

/** The framed medallion with skin under the parts — what the layers sit on. */
export const ROSE_RIG_BASE = require('../../assets/images/rose/rig/base-600.webp');
