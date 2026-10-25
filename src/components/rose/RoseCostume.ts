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
 * «وضع المراجعة»: the season twin (the amber cardigan, the pencil, the lamp) was drawn for
 * the vector picture and does not exist for the painted one yet, so the season shows the
 * same pictures until the founder paints it. `teacher.rose.costume` still gates the switch.
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

// Until her season picture is painted: the same pictures (see above).
const SEASON: RosePictures = NORMAL;

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
