/**
 * مدام روز's rig (founder 2026-10-25: «she doesn't move or make reaction or moving her lips
 * when she talks any more»). Her painted portrait, cut like الناظر's: one base with skin under
 * the parts, and the parts — her own brows, eyes and lips — as layers RoseLive moves. Every
 * box is in the 1200-pt frame of the framed medallion (the 600 px picture is that frame at
 * half size). Built by the session's rose2/rig.py; keep this in step with its manifest.json.
 */
export const ROSE_FRAME = 1200;

export type RoseLayer = 'brow_l' | 'brow_r' | 'eye_l' | 'eye_r' | 'mouth_in' | 'lip_lower';

/** x, y, w, h in the frame, and the pivot (fraction of the box) the part turns and scales about.
 *  The eyes pivot on the lash line: a blink closes DOWN to it (a squash to the middle read as a squint). */
export const ROSE_RIG: Record<RoseLayer, { box: [number, number, number, number]; pivot: [number, number]; source: number }> = {
  brow_l: { box: [486.1, 514.8, 100.3, 43.3], pivot: [0.5, 0.6], source: require('../../assets/images/rose/rig/brow_l.webp') },
  brow_r: { box: [620.6, 514.8, 111.7, 45.6], pivot: [0.5, 0.6], source: require('../../assets/images/rose/rig/brow_r.webp') },
  eye_l: { box: [492.9, 555.8, 88.9, 57.0], pivot: [0.5, 0.24], source: require('../../assets/images/rose/rig/eye_l.webp') },
  eye_r: { box: [634.3, 555.8, 93.5, 59.3], pivot: [0.5, 0.25], source: require('../../assets/images/rose/rig/eye_r.webp') },
  // The jaw (founder 2026-10-25 «lips isn't right neither smile»): the upper lip, the smile line and
  // the corners stay painted in the base; only the LOWER lip moves, uncovering the mouth's inside —
  // a still layer in the smile line's own dark — as it drops. At rest the two are the painting.
  mouth_in: { box: [563.6, 685.8, 100.3, 37.6], pivot: [0.5, 0], source: require('../../assets/images/rose/rig/mouth_in.webp') },
  lip_lower: { box: [563.6, 685.8, 100.3, 37.6], pivot: [0.5, 0], source: require('../../assets/images/rose/rig/lip_lower.webp') },
};

/** The framed medallion with skin under the parts — what the layers sit on. */
/** How far the lower lip drops at the widest syllable, in frame points (4.5 painting px × 1.14). */
export const ROSE_JAW_DROP = 5.1;

export const ROSE_RIG_BASE = require('../../assets/images/rose/rig/base-600.webp');
