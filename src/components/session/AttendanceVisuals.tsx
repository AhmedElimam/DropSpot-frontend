import { memo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { formatNumber } from '@/utils/format';

/**
 * A ring filled by present / roster — the one-glance answer to "how full is the room".
 * `onDark` draws it on a saturated dark fill (white track, white figures); `onHero` draws it
 * on the page hero through the hero tokens (ink by day, white by night).
 */
export const AttendanceRing = memo(function AttendanceRing({
  present, total, size = 76, stroke = 8, onDark = false, onHero = false, color,
}: { present: number; total: number; size?: number; stroke?: number; onDark?: boolean; onHero?: boolean; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, present / total) : 0;
  const fill = color ?? (onDark ? colors.white : onHero ? colors.onHero : colors.success);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={onDark ? 'rgba(255,255,255,0.18)' : onHero ? colors.onHeroChipBorder : colors.borderLight} strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={fill} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
        ) : null}
      </Svg>
      <Text style={{ fontFamily: fonts.bold, fontSize: size >= 70 ? 20 : 15, lineHeight: size >= 70 ? 26 : 20, color: onDark ? '#fff' : onHero ? colors.onHero : colors.textPrimary }}>
        {formatNumber(present)}
      </Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: onDark ? 'rgba(255,255,255,0.7)' : onHero ? colors.onHeroSoft : colors.textTertiary }}>
        {`من ${formatNumber(total)}`}
      </Text>
    </View>
  );
});

/**
 * Stacked bar: present (green) · absent (red) · still to record (paper). Each share is
 * drawn as a flex weight, so it needs no measurement and stays cheap in a long list.
 */
export const AttendanceBar = memo(function AttendanceBar({
  present, absent, total, height = 8, onDark = false,
}: { present: number; absent: number; total: number; height?: number; onDark?: boolean }) {
  const rest = Math.max(0, total - present - absent);
  if (total <= 0) {
    return <View style={{ height, borderRadius: radius.full, backgroundColor: onDark ? 'rgba(255,255,255,0.18)' : colors.borderLight }} />;
  }
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: radius.full, overflow: 'hidden', backgroundColor: onDark ? 'rgba(255,255,255,0.18)' : colors.borderLight }}>
      {present > 0 ? <View style={{ flex: present, backgroundColor: colors.success }} /> : null}
      {absent > 0 ? <View style={{ flex: absent, backgroundColor: colors.danger }} /> : null}
      {rest > 0 ? <View style={{ flex: rest }} /> : null}
    </View>
  );
});
