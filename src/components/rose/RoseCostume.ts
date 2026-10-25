import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { useSurface } from '@/ui/surfaces';

/**
 * مدام روز's pictures. Since 2026-10-25 she is PAINTED, in the same hand as الناظر (founder:
 * «that's the new rework of madam rose — we want our art style like el nazer now»): the
 * founder's three-pose sheet, cut out and set on her navy medallion with the gold ring and
 * the Dros Spot crown (scratchpad rose2/cut.py + compose.py). Her face moves by its OWN painted
 * parts — brows, eyes, lips cut as layers over a base (rose2/rig.py, src/rose/manifest.ts), so
 * she blinks, glances, talks and reacts (RoseLive) without anything drawn by us; any whole
 * expression (asleep, stern, proud…) must come from the image model with her portrait and
 * الناظر's attached (founder 2026-10-25: hand-painted closed eyes «look unnatural»).
 *
 * «وضع المراجعة» (founder 2026-10-25: «on revision mode her style used to change»): her season
 * twin, painted — the same figure with the blazer re-inked into the amber cardigan (badge,
 * buttons and pocket square kept), a pencil painted into her hair, and a warm desk lamp on her
 * disc (scratchpad rose2/season.py). Her face is untouched, so the rig's parts sit on the
 * season base exactly as on the usual one. `teacher.rose.costume` gates the switch.
 */
export type RosePictures = {
  /** 300 px — every portrait up to ~100 pt. */
  portrait: number;
  /** 600 px — the large frame on her desk (the 300 px one blurs above ~100 pt on a 3× screen). */
  large: number;
  /** 600 px — the rig's base: the framed medallion with skin under her brows, eyes and lips (src/rose/manifest). */
  liveBase: number;
};

const NORMAL: RosePictures = {
  portrait: require('../../../assets/images/rose/madam-rose.webp'),
  large: require('../../../assets/images/rose/madam-rose-600.webp'),
  liveBase: require('../../../assets/images/rose/rig/base-600.webp'),
};

const SEASON: RosePictures = {
  portrait: require('../../../assets/images/rose/madam-rose-season.webp'),
  large: require('../../../assets/images/rose/madam-rose-season-600.webp'),
  liveBase: require('../../../assets/images/rose/rig/season-base-600.webp'),
};

/** Her pictures, in or out of the season. */
export function rosePictures(season: boolean): RosePictures {
  return season ? SEASON : NORMAL;
}

/** Her pictures for now: the season's while «وضع المراجعة» is on (and the server lets her dress for it). */
export function useRosePictures(): RosePictures {
  const on = useRevisionActive();
  const dressed = useSurface('teacher.rose.costume');
  return rosePictures(on && dressed);
}
