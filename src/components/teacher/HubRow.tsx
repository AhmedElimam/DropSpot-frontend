import { memo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * The one list row for the teacher hubs (home attention list, management groups):
 * icon · title · subtitle · count badge or chevron. Module-level and memoised — the hubs
 * are tabs that re-render on every poll tick, and a row type declared inside a screen
 * body is rebuilt (native views and all) on each of those renders (Android heat, 2026-09-22).
 *
 * `badge` > 0 turns the row warm (amber border, count bubble): "this needs you".
 */
export const HubRow = memo(function HubRow({
  icon, title, sub, onPress, tint, badge = 0, loud = false, leading,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  onPress: () => void;
  tint?: string;
  badge?: number;
  /** Warm styling even without a count (an unanswered prompt). */
  loud?: boolean;
  /** Replaces the icon tile — مدام روز's portrait on her row (founder 2026-10-07). */
  leading?: ReactNode;
}) {
  const warm = loud || badge > 0;
  const color = tint ?? colors.brand;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: warm ? colors.warningLight : colors.surface,
        borderRadius: radius.lg, borderWidth: 1, borderColor: warm ? colors.warning : colors.border,
        padding: spacing.md, minHeight: 64, marginBottom: spacing.sm,
      }}
    >
      {leading ?? (
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: (warm ? colors.warning : color) + '18', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name={icon} size={22} color={warm ? colors.warning : color} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {badge > 0 ? (
        <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{badge}</Text>
        </View>
      ) : (
        <Icon name="back" size={18} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
});

/** Small grey group caption used above a run of HubRows. */
export const HubTitle = memo(function HubTitle({ children }: { children: string }) {
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{children}</Text>
  );
});

/** A square quick-action tile for the home grid. */
export const HubTile = memo(function HubTile({
  icon, title, onPress, tint, badge = 0,
}: { icon: IconName; title: string; onPress: () => void; tint?: string; badge?: number }) {
  const color = tint ?? colors.brand;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={{ flexBasis: '47%', flexGrow: 1, minHeight: 92, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, justifyContent: 'space-between' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '18', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name={icon} size={22} color={color} />
        </View>
        {badge > 0 ? (
          <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: spacing.sm }} numberOfLines={2}>{title}</Text>
    </TouchableOpacity>
  );
});
