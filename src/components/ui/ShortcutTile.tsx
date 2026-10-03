import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, shadows, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * The coloured, word-labelled shortcuts the teacher home uses, shared with the student and
 * parent homes. `ShortcutTile` is the compact square (four to a row); `ActionTile` is the
 * big two-per-row card with a subtitle, sized for an older parent's thumb.
 */
export function ShortcutTile({ icon, label, color, tint, onPress, badge }: {
  icon: IconName; label: string; color: string; tint: string; onPress: () => void; badge?: number;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label} style={{ width: '24%', alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={color} />
        {badge ? (
          <View style={{ position: 'absolute', top: -4, end: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.onPrimary }}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ActionTile({ icon, title, subtitle, color, tint, onPress }: {
  icon: IconName; title: string; subtitle?: string; color: string; tint: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        width: '48.5%', minHeight: 132, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
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
