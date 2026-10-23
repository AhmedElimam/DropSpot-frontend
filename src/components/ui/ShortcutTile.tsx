import { View, Text, TouchableOpacity, type DimensionValue } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { CountBadge } from './CountBadge';

/**
 * The coloured, word-labelled shortcuts the teacher home uses, shared with the student and
 * parent homes. `ShortcutTile` is the compact square (four to a row); `ActionTile` is the
 * big two-per-row card with a subtitle, sized for an older parent's thumb.
 */
export function ShortcutTile({ icon, label, color, tint, onPress, badge, width = '24%' }: {
  icon: IconName; label: string; color: string; tint: string; onPress: () => void; badge?: number; width?: DimensionValue;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label} style={{ width, alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={color} />
        <CountBadge count={badge} max={99} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ActionTile({ icon, title, subtitle, color, tint, onPress, width = '48.5%' }: {
  icon: IconName; title: string; subtitle?: string; color: string; tint: string; onPress: () => void; width?: DimensionValue;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        width, minHeight: 132, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
        padding: spacing.md, justifyContent: 'space-between', ...shadows.sm,
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={25} color={color} />
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.textPrimary }} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
