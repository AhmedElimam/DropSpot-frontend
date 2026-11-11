import { colors, isDark } from './index';

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
 *
 * Every token is a GETTER (founder 2026-11-12: «the chat on dark mode doesn't show the right
 * colours»). `colors` is rewritten when the scheme changes; a plain object here kept whatever
 * scheme was live at first import — paper-white bubbles and day ink on the navy room. The
 * staff bubble, the name colours and the badges had day-only hex values on top of that.
 */
export const chat = {
  /** The room's ground — the same canvas as every other screen. */
  get canvas() { return colors.background; },

  /** Your own words: filled indigo, white type. By night the deeper primary keeps white readable. */
  get bubbleMine() { return isDark() ? colors.primary : colors.brand; },
  textOnMine: '#FFFFFF',
  metaOnMine: 'rgba(255,255,255,0.62)',

  /** Everyone else: a plain surface card. */
  get bubbleTheirs() { return colors.surface; },
  get bubbleTheirsBorder() { return colors.border; },
  get text() { return colors.textPrimary; },
  get meta() { return colors.textTertiary; },

  /** The teacher or a granted assistant — the one place the apricot accent earns its keep. */
  get bubbleStaff() { return colors.accentWarmTint; },
  get bubbleStaffBorder() { return isDark() ? '#6B4E14' : '#F0DDB8'; },
  /** The adult's name, as type on the staff bubble. */
  get staffInk() { return isDark() ? colors.accentText : '#8A5B00'; },
  /** The «المعلم» / «مساعد» badge: a fill that carries white type in both schemes. */
  get staffBadge() { return isDark() ? '#A8700A' : '#8A5B00'; },

  /** A message a moderator removed: still readable to them, visibly withdrawn. */
  get bubbleHidden() { return colors.dangerLight; },
  get hiddenInk() { return colors.dangerText; },

  /** The day separator. */
  get chipBg() { return colors.surface; },
  get chipBorder() { return colors.border; },
  get chipText() { return colors.textTertiary; },

  /** Composer + header chrome. */
  get bar() { return colors.surface; },
  get barBorder() { return colors.border; },

  /** Sent tick; the second, lit, when every member has read it (members' read cursors). */
  tick: 'rgba(255,255,255,0.62)',
  tickSeen: '#8FE3F0',

  /** A message that never reached the server, on the indigo bubble: warm enough to be
   *  seen, not a red alarm — the words are still right there, one tap from being sent. */
  failedInk: '#FFD1CC',
};

/**
 * Name colours for a group room, hashed per sender — the cue that tells three classmates
 * apart at a glance. Drawn from the product's own ink/indigo/teal/plum family rather than a
 * messenger's primaries, so a busy room still looks like this app. The day inks are too deep
 * to read on navy, so the night has the same ten hues lifted.
 */
const NAME_COLORS = [
  '#34419B', '#00695C', '#7B1FA2', '#B26500', '#00838F',
  '#4E342E', '#283593', '#AD1457', '#33691E', '#5D4037',
] as const;
const NAME_COLORS_NIGHT = [
  '#9DAEFF', '#5FD3C0', '#D79BF0', '#FFB454', '#6FD6E3',
  '#D9B9A9', '#A8B4FF', '#F58CB8', '#A6D97A', '#D8B894',
] as const;

/** A sender's colour as TYPE (their name, a quote's edge) — follows the scheme. */
export function senderColor(userId: number): string {
  const list = isDark() ? NAME_COLORS_NIGHT : NAME_COLORS;
  return list[Math.abs(userId) % list.length];
}

/** A sender's colour as a FILL under white type (an avatar) — the same in both schemes. */
export function senderFill(userId: number): string {
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
