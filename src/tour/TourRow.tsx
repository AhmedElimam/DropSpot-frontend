import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useTourStore } from './store';
import { tourForRole } from './tours';

/** «جولة تعريفية» — replay the tour from the settings of any role. Goes home first; the tour takes it from there. */
export function TourRow({ home }: { home: Href }) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const start = useTourStore((s) => s.start);
  const def = tourForRole(role);
  if (!def) return null;
  const replay = () => {
    router.navigate(home);
    setTimeout(() => start(def), 350);
  };
  return (
    <TouchableOpacity onPress={replay} activeOpacity={0.75} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="play" size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('tour.row_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('tour.row_sub')}</Text>
      </View>
      <Icon name="back" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}
