import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/format';
import { subscriptionSheet } from './receipt';
import { SubscriptionSheetView } from './SubscriptionSheetView';

/**
 * «حالة الاشتراك» in settings (founder 2026-10-25): the payment status and the dates — paid
 * until, exempt until, the open bill — as the same stamped sheet her popup shows. From the
 * login payload; tap → the subscription screen. A trial or a bill on its way gets one line.
 */
export function SubscriptionStatusCard() {
  const { t } = useTranslation();
  const sub = useAuthStore((s) => s.user?.subscription ?? null);
  const female = useAuthStore((s) => s.user?.gender === 'female');
  const sheet = subscriptionSheet(sub, t, female);
  const open = () => router.push('/(teacher)/subscription' as Href);
  const phaseLabel = sub ? t(`subscription.phase_${sub.phase}`) : t('subscription.row_sub');
  const line = !sub ? null
    : sub.phase === 'trial' ? t('subscription.status_trial_line', { date: sub.trial_ends_at ? formatDate(sub.trial_ends_at) : '—' })
    : sub.phase === 'lapsed' ? t('subscription.status_lapsed_line')
    : null;

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${t('subscription.settings_card_title')}: ${phaseLabel}`}
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sheet || line ? spacing.md : 0 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
          <Icon name="card" size={21} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('subscription.settings_card_title')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>{phaseLabel}</Text>
        </View>
        <Icon name="back" size={20} color={colors.textTertiary} />
      </View>
      {sheet ? <SubscriptionSheetView sheet={sheet} compact /> : null}
      {line ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{line}</Text> : null}
    </TouchableOpacity>
  );
}
