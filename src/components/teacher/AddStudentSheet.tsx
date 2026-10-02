import { SheetModal } from '@/components/ui/SheetModal';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

/**
 * «إضافة طالب» — the four ways a student joins, in one sheet, instead of four cards spread
 * over Home and Management (founder 2026-10-02: "too much, not simple"). Each door opens
 * the same «شروط التسجيل» afterwards. The fast-register door follows the super-admin flag.
 */
export function AddStudentSheet({ visible, onClose, courseId }: { visible: boolean; onClose: () => void; courseId?: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: flags } = useFeatureFlags();
  const go = (href: Href) => { onClose(); setTimeout(() => router.push(href), 60); };
  const param = courseId ? `?courseId=${courseId}` : '';

  const options: { icon: IconName; title: string; sub: string; href: Href; show: boolean }[] = [
    { icon: 'scan', title: t('add_student.card'), sub: t('add_student.card_sub'), href: '/(teacher)/enroll' as Href, show: true },
    { icon: 'add', title: t('add_student.fast'), sub: t('add_student.fast_sub'), href: `/(teacher)/record-student${param}` as Href, show: !!flags?.fast_register },
    { icon: 'phone', title: t('add_student.phone'), sub: t('add_student.phone_sub'), href: `/(teacher)/invite-phone${param}` as Href, show: true },
    { icon: 'send', title: t('add_student.link'), sub: t('add_student.link_sub'), href: '/(teacher)/invite-link' as Href, show: true },
  ];

  return (
    <SheetModal visible={visible} onClose={onClose} style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: 2 }}>{t('add_student.title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>{t('add_student.subtitle')}</Text>
          {options.filter((o) => o.show).map((o) => (
            <TouchableOpacity key={o.title} onPress={() => go(o.href)} activeOpacity={0.8} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 64, marginBottom: spacing.sm }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                <Icon name={o.icon} size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{o.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 2 }}>{o.sub}</Text>
              </View>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
    </SheetModal>
  );
}
