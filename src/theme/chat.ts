import { colors } from './index';

/**
 * Chat tokens, in one place.
 *
 * These are Sanad tokens, not a messenger's. The room reads as part of THIS product: the
 * warm paper canvas, ink-indigo for your own voice, white cards for everyone else's, the
 * apricot accent reserved for the one human moment (an adult speaking). The earlier pass
 * borrowed WhatsApp's palette and doodled wallpaper wholesale and read as a clone of
 * someone else's app — familiar, but not ours (founder, 2026-09-13).
 *
 * The shape of a message bubble is deliberately the one this app ALREADY uses in a ticket
 * thread: filled brand for mine, bordered surface for theirs, one squared corner. A student
 * who has read a ticket reply has already learnt how to read this room.
 */
export const chat = {
  /** The room's ground — the same warm paper as every other screen. */
  canvas: colors.background,

  /** Your own words: filled ink indigo, white type. */
  bubbleMine: colors.brand,
  textOnMine: '#FFFFFF',
  metaOnMine: 'rgba(255,255,255,0.62)',

  /** Everyone else: a plain surface card. */
  bubbleTheirs: colors.surface,
  bubbleTheirsBorder: colors.border,
  text: colors.textPrimary,
  meta: colors.textTertiary,

  /** The teacher or a granted assistant — the one place the apricot accent earns its keep. */
  bubbleStaff: colors.accentWarmTint,
  bubbleStaffBorder: '#F0DDB8',
  staffInk: '#8A5B00',

  /** A message a moderator removed: still readable to them, visibly withdrawn. */
  bubbleHidden: colors.dangerLight,
  hiddenInk: colors.dangerText,

  /** The day separator. */
  chipBg: colors.surface,
  chipBorder: colors.border,
  chipText: colors.textTertiary,

  /** Composer + header chrome. */
  bar: colors.surface,
  barBorder: colors.border,

  /** Sent tick. There is no second tick: this product has no read receipts, on purpose. */
  tick: 'rgba(255,255,255,0.62)',

  /** A message that never reached the server, on the ink-indigo bubble: warm enough to be
   *  seen, not a red alarm — the words are still right there, one tap from being sent. */
  failedInk: '#FFD1CC',
} as const;

/**
 * Name colours for a group room, hashed per sender — the cue that tells three classmates
 * apart at a glance. Drawn from the product's own ink/indigo/teal/plum family rather than a
 * messenger's primaries, so a busy room still looks like this app.
 */
const NAME_COLORS = [
  '#34419B', '#00695C', '#7B1FA2', '#B26500', '#00838F',
  '#4E342E', '#283593', '#AD1457', '#33691E', '#5D4037',
] as const;

export function senderColor(userId: number): string {
  return NAME_COLORS[Math.abs(userId) % NAME_COLORS.length];
}

/**
 * A stable pseudo-waveform for a voice note — same message, same bars, every render, on
 * every device. Derived from the id rather than decoded from the audio: decoding would mean
 * downloading and analysing the file just to draw 28 rectangles.
 */
export function waveform(seed: number, bars = 28): number[] {
  const out: number[] = [];
  let x = Math.abs(seed) * 9301 + 49297;
  for (let i = 0; i < bars; i++) {
    x = (x * 9301 + 49297) % 233280;
    // 0.25–1.0, so no bar collapses to an invisible sliver.
    out.push(0.25 + (x / 233280) * 0.75);
  }
  return out;
}
