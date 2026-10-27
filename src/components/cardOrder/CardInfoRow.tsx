import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { TourTarget } from '@/tour/TourTarget';

/**
 * «كارت دروس سبوت» on a family's profile tab (founder 2026-10-24: «know more about it on the
 * more screen — why you need a card»): opens /card-info. The tour's last step points here.
 */
export function CardInfoRow() {
  const { t } = useTranslation();
  return (
    <TourTarget id="profile:card">
      <TouchableOpacity onPress={() => router.push('/card-info' as Href)} activeOpacity={0.75} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="card" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('card_info.row_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('card_info.row_sub')}</Text>
        </View>
        <Icon name="back" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </TourTarget>
  );
}
