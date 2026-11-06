import { View, Text } from 'react-native';
import { colors } from '@/theme/index';
import { formatNumber } from '@/utils/format';

/**
 * A count on a button's corner (founder 2026-10-23: «the numbers on the notifications and on
 * مدام روز cover the icons, and sit differently from one phone to another»).
 *
 * Its CENTRE sits on the shape's own edge at the top corner, the way a phone puts a count on an
 * app icon (founder 2026-10-23, after a first try pushed it out past the corner: «doesn't look
 * good»): on a rounded tile that is the corner's curve (`offset` 4 for a 58-pt tile with radius
 * 20); on a round portrait, a point of its ring (`at`). Fixed points, so the same on every phone,
 * and never on the glyph itself. `end` (not `insetInlineEnd`, which older React Native builds
 * ignore) follows the right-to-left layout. A ring in the page colour keeps it apart from what it
 * overlaps. Past `max` it reads «٩+» in that order: the pieces are laid out left to right.
 */
export function CountBadge({ count, max = 9, offset = 4, at, size = 20, bg, ring, color, ringWidth = 2 }: {
  count?: number | null; max?: number; offset?: number; size?: number;
  /** An exact place instead of the corner (a round picture: a point on its ring). */
  at?: { top: number; end: number };
  /** Fill, ring and digit colours (default: danger red, the page colour, white). */
  bg?: string; ring?: string; color?: string; ringWidth?: number;
}) {
  if (!count || count <= 0) return null;
  return (
    <View pointerEvents="none"
      style={{ position: 'absolute', top: at ? at.top : -offset, end: at ? at.end : -offset, zIndex: 2, ...circle(count, max, size),
        backgroundColor: bg ?? colors.danger, borderWidth: ringWidth, borderColor: ring ?? colors.background }}>
      <Digits count={count} max={max} box={size - ringWidth * 2} color={color ?? '#fff'} fontSize={11} />
    </View>
  );
}

/**
 * The same count in the flow of a row — beside a filter's label, at the end of a list row
 * (founder 2026-11-06: «numbers on the tabs aren't right, like the one we fixed before»). Every
 * hand-drawn count bubble had Cairo's digits riding high in the circle; this is the one place
 * they are drawn.
 */
export function CountPill({ count, max = 99, size = 20, bg, color, fontSize }: {
  count?: number | null; max?: number; size?: number; bg?: string; color?: string; fontSize?: number;
}) {
  if (!count || count <= 0) return null;
  return (
    <View style={{ ...circle(count, max, size), backgroundColor: bg ?? colors.accent }}>
      <Digits count={count} max={max} box={size} color={color ?? colors.onAccent} fontSize={fontSize} />
    </View>
  );
}

/** One digit: a true circle; more: a pill. Laid out left to right, so «٩+» reads in order. */
function circle(count: number, max: number, size: number) {
  const single = count <= max && count < 10;
  return {
    minWidth: size, width: single ? size : undefined, height: size, borderRadius: size / 2, paddingHorizontal: single ? 0 : Math.round(size / 5),
    flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center',
  } as const;
}

/**
 * The digits are in the phone's own font, as the system draws app-icon badges: Cairo's tall
 * ascent sits its digits off the middle of a small line box, so the number never looked centred
 * in the circle (founder 2026-10-23). The line box is exactly the inside of the circle.
 */
function Digits({ count, max, box, color, fontSize }: { count: number; max: number; box: number; color: string; fontSize?: number }) {
  const text = { fontSize: fontSize ?? Math.min(13, Math.max(10, Math.round(box * 0.62))), fontWeight: '700', lineHeight: box, height: box, color, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false } as const;
  const over = count > max;
  return (
    <>
      <Text style={text}>{formatNumber(over ? max : count)}</Text>
      {over ? <Text style={text}>+</Text> : null}
    </>
  );
}
