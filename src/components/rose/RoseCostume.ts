import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { useSurface } from '@/ui/surfaces';

/**
 * مدام روز's look for «وضع المراجعة»: «ليلة المراجعة», study night (founder 2026-10-17: the
 * three runtime looks of 10-16 — the amber stole + stopwatch brooch, the mortarboard, the amber
 * ring with its tab — «looking poorly»: vector props laid OVER her raster picture read as
 * stickers). So the season is now drawn INTO her artwork, by the same hand and the same
 * pipeline as her own picture (the site's madam-rose.svg, rendered in Chrome at 1200 px,
 * Lanczos down, cwebp q90 for 300 px / q88 for 600 px):
 *
 *   · her navy blazer is a warm AMBER knit cardigan — ribbed front bands where the lapels were, a
 *     ribbed pocket edge, a horn button where the bands cross; her cream blouse, white collar,
 *     gold rose button and brass name plate «مدام روز» stay exactly where they were
 *   · a yellow pencil tucked into her curls above her right ear (the picture's right, by the
 *     silver curls; a curl of hers falls over its middle) — clear of her eyes, glasses, brows
 *     and the swinging hoop
 *   · the room is deep indigo with a warm desk lamp glowing from the upper left behind her, a
 *     faint warm rim on her curls and the shoulder on that side; the gold ring, the laurel and
 *     the DS medallion stay gold
 *
 * Each picture has its season twin, same size, same encoding: madam-rose-season (300 px),
 * -season-600, and -season-live-base (still registered on RoseLive's eye / lid / lip / hoop /
 * brow layers — checked by compositing them back). Nothing is drawn over her at runtime any
 * more, so every place that shows her — the live figure, her portrait, her sleeping picture,
 * the tour — simply asks `useRosePictures()` which picture to show. Off season: exactly the
 * pictures of before. The server can still keep her in her blazer through the season by
 * hiding `teacher.rose.costume` (the old look's surface id).
 */
export type RosePictures = {
  /** 300 px — every portrait up to ~100 pt. */
  portrait: number;
  /** 600 px — the large frame on her desk (the 300 px one blurs above ~100 pt on a 3× screen). */
  large: number;
  /** 600 px, without the parts RoseLive animates (eyes, lids, lips, hoops, brows). */
  liveBase: number;
};

const NORMAL: RosePictures = {
  portrait: require('../../../assets/images/rose/madam-rose.webp'),
  large: require('../../../assets/images/rose/madam-rose-600.webp'),
  liveBase: require('../../../assets/images/rose/madam-rose-live-base.webp'),
};

// The amber cardigan, chosen by the founder 2026-10-17 («I like it, let's set it»); the burgundy
// alternative was drawn for the comparison and left out of the app.
const SEASON: RosePictures = {
  portrait: require('../../../assets/images/rose/madam-rose-season.webp'),
  large: require('../../../assets/images/rose/madam-rose-season-600.webp'),
  liveBase: require('../../../assets/images/rose/madam-rose-season-live-base.webp'),
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
