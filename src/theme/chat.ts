import { colors } from './index';

/**
 * Chat-only tokens, in one place.
 *
 * The room deliberately looks like the messenger every Egyptian student already uses — a
 * papered ground, a tinted bubble for your own words, a white one for everyone else, the
 * time tucked inside the bubble. Familiarity is the point: this is meant to REPLACE the
 * WhatsApp group, and a room that feels foreign gets abandoned for the one that doesn't.
 *
 * Where it deliberately differs: a STAFF bubble is warm-tinted and its name badge says
 * «المعلّم». WhatsApp has no such idea, but this room does — a child must always be able to
 * tell an adult's voice at a glance, and colour is faster than reading a name.
 *
 * Change `bubbleMine` alone to re-tone the whole room.
 */
export const chat = {
  /** The papered ground behind the messages. */
  wallpaper: '#E9E2D6',
  /** Doodle ink on the wallpaper — barely there by design; it must never fight the text. */
  wallpaperInk: '#1A2140',
  wallpaperInkOpacity: 0.045,

  /** Your own words. */
  bubbleMine: '#D9FDD3',
  /** Everyone else. */
  bubbleTheirs: '#FFFFFF',
  /** The teacher or a granted assistant — the adult in the room. */
  bubbleStaff: '#FFF4E0',
  bubbleStaffBorder: '#F0DDB8',

  /** Text inside any bubble: one ink, on every ground above. */
  text: colors.textPrimary,
  meta: '#667781',
  metaOnMine: '#4E7A52',

  /** The date pill floating over the wallpaper. */
  chip: 'rgba(255,255,255,0.92)',
  chipText: '#4A5568',

  /** Composer + header. */
  bar: '#F6F3ED',
  barBorder: '#DED7C9',

  /** Sent tick. There is no second tick: this product has no read receipts, on purpose. */
  tick: '#7BA88A',
} as const;

/**
 * Group-chat name colours, hashed per sender — the cue that tells three classmates apart at
 * a glance without reading. Chosen to stay legible on white and on the warm staff tint.
 */
const NAME_COLORS = [
  '#C2185B', '#6A1B9A', '#283593', '#00695C', '#B26500',
  '#4E342E', '#AD1457', '#00838F', '#33691E', '#7B1FA2',
] as const;

export function senderColor(userId: number): string {
  return NAME_COLORS[Math.abs(userId) % NAME_COLORS.length];
}
