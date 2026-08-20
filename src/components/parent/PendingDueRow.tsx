import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatEGP } from '@/utils/currency';
import type { PendingDue } from '@/api/invoices';

/**
 * Compact one-line due, for the home "مستحقات" list (spec .acard/.arow): an icon
 * tile, the item + course, "amount · status", and a chevron into the invoices
 * screen. The full pay-here detail lives in PendingDueCard on that screen — this
 * is only the at-a-glance summary.
 */
export function PendingDueRow({ due, showStudent, onPress }: { due: PendingDue; showStudent?: boolean; onPress?: () => void }) {
  const { t } = useTranslation();
  const title = due.course_name ? `${due.title} — ${due.course_name}` : due.title;
  const statusText = due.status === 'partial' ? t('dues.partial') : t('dues.unpaid');
  const icon = due.kind === 'booking' ? 'calendar' : 'book';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, paddingHorizontal: 15 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.warnWash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={colors.warn} outline />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
          {showStudent && due.student_name ? `${due.student_name} · ` : ''}{formatEGP(due.amount)} · {statusText}
        </Text>
      </View>
      <Icon name="back" size={16} color={colors.faint} />
    </TouchableOpacity>
  );
}
