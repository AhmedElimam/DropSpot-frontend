import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { attendanceLabel } from '@/utils/privateLesson';
import type { AttendanceModeFields } from '@/types/attendance-mode';

/**
 * The quiet pill a private lesson wears wherever a door course would show an outcome, a
 * check-in badge or a rate: «درس خصوصي · بدون تسجيل حضور» in the server's own words when
 * it sent them (founder 2026-10-12). `short` draws the one-word «خصوصي» chip for tight rows.
 */
export function PrivateLessonChip({ of, short, style }: { of?: AttendanceModeFields | null; short?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const label = short ? t('family_ui.private_chip') : attendanceLabel(of, t('family_ui.private_lesson'));
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.infoLight, borderRadius: radius.full, paddingVertical: short ? 2 : 4, paddingHorizontal: short ? 8 : 10, maxWidth: '100%' }, style]}>
      <Icon name="book" size={short ? 11 : 12} color={colors.infoText} outline />
      <Text style={{ fontFamily: fonts.bold, fontSize: short ? 11 : 12, color: colors.infoText, flexShrink: 1 }} numberOfLines={1}>{label}</Text>
    </View>
  );
}
