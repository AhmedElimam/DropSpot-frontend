import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';

/** «١ الطالب» — a numbered step heading inside a door's sheet (fast register's look). */
export function StepHead({ n, icon, title }: { n: number; icon: IconName; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onPrimary }}>{formatNumber(n)}</Text>
      </View>
      <Icon name={icon} size={16} color={colors.textSecondary} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{title}</Text>
    </View>
  );
}
