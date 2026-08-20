import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';

/**
 * Today read as a *day*, not a list (spec 3.3). A vertical rail sits on the
 * right (RTL) with a state dot per row: done = filled green, now = filled brand
 * with a wash ring + the row gets a brand border, upcoming = hollow. Each row is
 * a card with a time badge, title + subtitle, and an optional chip — pass a
 * `<StatusBadge>` so the color+label status rule stays in one place.
 */

export type TimelineState = 'done' | 'now' | 'upcoming' | 'missed';

export interface TimelineItem {
  id: string | number;
  state: TimelineState;
  /** Short time label for the badge, e.g. "٤:٠٠ م". */
  time: string;
  title: string;
  subtitle?: string;
  /** Trailing chip — typically a <StatusBadge status=… size="sm" />. */
  chip?: ReactNode;
  onPress?: () => void;
}

const RAIL_W = 22;
const DOT_TOP = 26; // offset of the dot from the row's top, aligned near the title

function Dot({ state }: { state: TimelineState }) {
  if (state === 'now') {
    return (
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} />
      </View>
    );
  }
  if (state === 'done') {
    return <View style={{ width: 13, height: 13, borderRadius: 6.5, backgroundColor: colors.success }} />;
  }
  if (state === 'missed') {
    return <View style={{ width: 13, height: 13, borderRadius: 6.5, backgroundColor: colors.danger }} />;
  }
  return <View style={{ width: 13, height: 13, borderRadius: 6.5, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderStrong }} />;
}

function Row({ item, isFirst, isLast }: { item: TimelineItem; isFirst: boolean; isLast: boolean }) {
  const isNow = item.state === 'now';
  const dotSize = isNow ? 20 : 13;
  const Wrapper: typeof TouchableOpacity | typeof View = item.onPress ? TouchableOpacity : View;

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
      {/* Rail (right in RTL). Line halves bridge the gap between cards. */}
      <View style={{ width: RAIL_W, alignItems: 'center' }}>
        {!isFirst ? (
          <View style={{ position: 'absolute', top: 0, height: DOT_TOP, width: 2.5, backgroundColor: '#E4E1D7' }} />
        ) : null}
        {!isLast ? (
          <View style={{ position: 'absolute', top: DOT_TOP + dotSize, bottom: -spacing.sm, width: 2.5, backgroundColor: '#E4E1D7' }} />
        ) : null}
        <View style={{ position: 'absolute', top: DOT_TOP + (isNow ? 0 : 3) }}>
          <Dot state={item.state} />
        </View>
      </View>

      {/* Card */}
      <Wrapper
        {...(item.onPress ? { onPress: item.onPress, activeOpacity: 0.7 } : {})}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: isNow ? 1.5 : 1,
          borderColor: isNow ? colors.brand : colors.line,
          padding: spacing.md,
          ...shadows.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink }} numberOfLines={2}>{item.title}</Text>
          {item.subtitle ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>

        {item.chip ? <View>{item.chip}</View> : null}

        {/* Time badge (left in RTL) */}
        <View style={{ minWidth: 56, alignItems: 'center', backgroundColor: colors.brandTint, borderRadius: 11, paddingVertical: 6, paddingHorizontal: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{item.time}</Text>
        </View>
      </Wrapper>
    </View>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <Row key={item.id} item={item} isFirst={i === 0} isLast={i === items.length - 1} />
      ))}
    </View>
  );
}
