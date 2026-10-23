import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';
import { formatNumber } from '@/utils/format';

/**
 * A count on a button's corner (founder 2026-10-23: «the numbers on the notifications and on
 * مدام روز cover the icons, and sit differently from one phone to another»).
 *
 * It sits OUTSIDE the glyph: on the parent's corner, pushed past it by a fixed offset in points,
 * so it lands in the same place on every phone. `end` (not `insetInlineEnd`, which older React
 * Native builds ignore) follows the app's right-to-left layout. A ring in the page colour keeps it
 * apart from whatever it overlaps. Past `max` it reads «٩+» in that order: the two pieces are
 * laid out left to right, so the «+» never jumps to the front in Arabic.
 */
export function CountBadge({ count, max = 9, offset = 6, size = 20 }: { count?: number | null; max?: number; offset?: number; size?: number }) {
  if (!count || count <= 0) return null;
  const over = count > max;
  const text = { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 13, color: '#fff', includeFontPadding: false } as const;
  return (
    <View pointerEvents="none"
      style={{ position: 'absolute', top: -offset, end: -offset, zIndex: 2, minWidth: size, height: size, borderRadius: size / 2, paddingHorizontal: 4,
        backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.background, flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={text}>{formatNumber(over ? max : count)}</Text>
      {over ? <Text style={text}>+</Text> : null}
    </View>
  );
}
