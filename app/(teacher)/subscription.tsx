import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SubscriptionPanel } from '@/components/subscription/SubscriptionPanel';

/** «الاشتراك» from settings: the same panel as the wall, with a way back. */
export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t('common.back')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('subscription.title')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SubscriptionPanel />
      </ScrollView>
    </View>
  );
}
