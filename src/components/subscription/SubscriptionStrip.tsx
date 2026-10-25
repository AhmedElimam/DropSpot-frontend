import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatNumber } from '@/utils/format';

/**
 * The subscription on the teacher's home (founder 2026-10-25): ONLY when something needs
 * doing — an open bill, a late one, a walled account, the trial over with the bill on its
 * way, or adding students frozen. A paid or exempt account sees nothing; the trial has its own
 * quiet corner tag across the app (TrialCornerTag). An alert card in the bill's colour, with
 * the amount, the date that matters, the days left and one button. From the login payload — no
 * request of its own. An assistant sees it only for a bill or the freeze, as their teacher's.
 */
export function SubscriptionStrip({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const sub = useAuthStore((s) => s.user?.subscription ?? null);
  const role = useAuthStore((s) => s.role);
  if (!sub) return null;
  const locked = !!sub.enroll_locked;
  const phase = sub.phase;
  const owing = phase === 'pending' || phase === 'late' || phase === 'blocked';
  if (!locked && !owing && phase !== 'lapsed') return null;
  if (role === 'assistant' && !locked && !owing) return null;

  const n = (v: number | null | undefined) => formatNumber(Number(v ?? 0), { maximumFractionDigits: 0 });
  const day = (d: string | null) => (d ? formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) : '—');
  const forAssistant = role === 'assistant' ? t('subscription.strip_for_assistant') : '';
  const days = sub.days_left ?? 0;

  let icon: IconName = 'card';
  let ink = colors.warningDark;
  let tint = colors.warningLight;
  let title = '';
  let body = '';
  let amount: string | null = null;
  let countdown: string | null = null;
  let cta = t('subscription.cta_pay');
  if (phase === 'late' || phase === 'blocked') {
    icon = phase === 'blocked' ? 'lock' : 'warning'; ink = colors.danger; tint = colors.dangerLight;
    title = forAssistant + (phase === 'blocked' ? t('subscription.phase_blocked') : t('subscription.banner_late_t'));
    body = phase === 'blocked' ? t('subscription.banner_blocked_b') : t('subscription.banner_late_b', { date: day(sub.block_at) });
    amount = `${n(sub.price)} ${t('subscription.egp')}`;
    if (phase === 'late') countdown = days > 0 ? t('subscription.banner_days_left', { n: n(days) }) : t('subscription.banner_last_day');
  } else if (phase === 'pending') {
    title = forAssistant + t('subscription.banner_pending_t');
    body = t('subscription.banner_pending_b', { date: day(sub.late_at) });
    amount = `${n(sub.price)} ${t('subscription.egp')}`;
    countdown = days > 0 ? t('subscription.banner_days_left', { n: n(days) }) : t('subscription.banner_last_day');
  } else if (locked) {
    icon = 'lock'; ink = colors.primary; tint = colors.primaryLight;
    title = forAssistant + t('subscription.strip_locked'); body = t('subscription.strip_locked_sub');
    cta = t('subscription.cta_activate');
  } else {
    icon = 'clock'; ink = colors.primary; tint = colors.primaryLight;
    title = t('subscription.phase_lapsed'); body = t('subscription.banner_lapsed_b', { days: n(sub.prices.grace_days) });
    cta = t('subscription.cta_details');
  }
  // The freeze rides on a bill too: say it under the bill's own line.
  const frozenToo = locked && owing;
  const open = () => router.push('/(teacher)/subscription' as Href);

  return (
    <TouchableOpacity onPress={open} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`}
      style={[{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1.5, borderColor: tint, overflow: 'hidden', ...shadows.sm }, style]}>
      {/* The bill's colour, as a band across the top. */}
      <View style={{ height: 4, backgroundColor: ink }} />
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={22} color={ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 23, color: colors.textPrimary }} numberOfLines={2}>{title}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2 }} numberOfLines={3}>{body}</Text>
            {frozenToo ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Icon name="lock" size={13} color={colors.textTertiary} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary }}>{t('subscription.strip_locked')}</Text>
              </View>
            ) : null}
          </View>
          {countdown ? (
            <View style={{ backgroundColor: tint, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: ink }}>{countdown}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {amount ? <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }} numberOfLines={1} adjustsFontSizeToFit>{amount}</Text> : <View style={{ flex: 1 }} />}
          {role === 'assistant' ? null : (
            <View style={{ backgroundColor: ink, borderRadius: radius.full, paddingHorizontal: spacing.lg, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onPrimary }}>{cta}</Text>
              <Icon name="back" size={14} color={colors.onPrimary} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
