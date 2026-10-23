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
export function CountBadge({ count, max = 9, offset = 4, at, size = 20 }: {
  count?: number | null; max?: number; offset?: number; size?: number;
  /** An exact place instead of the corner (a round picture: a point on its ring). */
  at?: { top: number; end: number };
}) {
  if (!count || count <= 0) return null;
  const over = count > max;
  // The digits are in the phone's own font, as the system draws app-icon badges: Cairo's tall
  // ascent sits its digits off the middle of a small line box, so the number never looked centred
  // in the circle (founder 2026-10-23). The line box is exactly the inside of the 2-pt ring.
  const inner = size - 4;
  const text = { fontSize: 11, fontWeight: '700', lineHeight: inner, height: inner, color: '#fff', textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false } as const;
  // One digit: a true circle, not a pill.
  const single = !over && count < 10;
  return (
    <View pointerEvents="none"
      style={{ position: 'absolute', top: at ? at.top : -offset, end: at ? at.end : -offset, zIndex: 2, minWidth: size, width: single ? size : undefined, height: size, borderRadius: size / 2, paddingHorizontal: single ? 0 : 4,
        backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.background, flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={text}>{formatNumber(over ? max : count)}</Text>
      {over ? <Text style={text}>+</Text> : null}
    </View>
  );
}
