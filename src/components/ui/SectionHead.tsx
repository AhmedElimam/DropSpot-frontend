import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * A section title with a small coloured icon tile beside it and an optional action on the
 * far side — the shape the teacher home introduced, shared so the student and parent homes
 * read the same way (founder 2026-10-03: «some love on the student and parent side»).
 */
export function SectionHead({ icon, color, tint, title, action, onAction }: {
  icon: IconName; color: string; tint?: string; title: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: tint ?? `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={color} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{title}</Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
