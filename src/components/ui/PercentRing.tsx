import { memo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';
import { formatNumber } from '@/utils/format';

/**
 * A percentage as a ring: the figure large in the middle, a calm caption under it, the arc
 * coloured by how good the figure is (green ≥ 90, brand ≥ 75, apricot below). The student
 * home's attendance rate (founder 2026-10-03: «the UI of the percentage rate needs love»).
 */
export const PercentRing = memo(function PercentRing({ value, size = 112, stroke = 11, caption, color }: {
  value: number; size?: number; stroke?: number; caption?: string; color?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = color ?? (pct >= 90 ? colors.success : pct >= 75 ? colors.brand : colors.accent);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ now: pct, min: 0, max: 100 }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.borderLight} strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" />
        ) : null}
      </Svg>
      {/* Arabic-Indic digits ride high: a loose line height keeps «١٠٠٪» from clipping. */}
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.24, lineHeight: size * 0.34, color: tone, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>{formatNumber(pct)}%</Text>
      {caption ? <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textTertiary, maxWidth: size * 0.7 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{caption}</Text> : null}
    </View>
  );
});
