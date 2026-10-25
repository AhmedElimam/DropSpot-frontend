import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatNumber } from '@/utils/format';

/**
 * The platform subscription at the top of the teacher's home (founder 2026-10-25): where
 * the trial stands, the open bill, the late price, or that all is well. From the login
 * payload — no request of its own. Tap → the subscription screen. Demo accounts see nothing;
 * an assistant only what concerns them (a bill, the late price).
 */
export function SubscriptionStrip() {
  const { t } = useTranslation();
  const sub = useAuthStore((s) => s.user?.subscription ?? null);
  const role = useAuthStore((s) => s.role);
  // Founder 2026-10-25: the strip is for teachers who pay — an exempt account (founding, distinguished, demo, admin) sees nothing.
  if (!sub || sub.phase === 'exempt') return null;
  const concernsAssistant = !!sub.enroll_locked || sub.phase === 'pending' || sub.phase === 'late' || sub.phase === 'blocked';
  if (role === 'assistant' && !concernsAssistant) return null;

  const n = (v: number | null | undefined) => formatNumber(Number(v ?? 0), { maximumFractionDigits: 0 });
  const day = (d: string | null) => (d ? formatDate(d) : '—');
  const days = sub.days_left ?? 0;
  const p = sub.prices;
  const forAssistant = role === 'assistant' ? t('subscription.strip_for_assistant') : '';

  let icon: IconName = 'card';
  let tone = colors.success;
  let bg = colors.successLight;
  let title = '';
  let body = '';
  if (sub.enroll_locked) {
    icon = 'lock'; tone = colors.warningDark; bg = colors.warningLight;
    title = forAssistant + t('subscription.strip_locked'); body = t('subscription.strip_locked_sub');
  } else switch (sub.phase) {
    case 'trial':
      icon = 'star'; title = t('subscription.strip_trial', { count: days }); body = t('subscription.strip_trial_sub', { term: n(p.term), year: n(p.year), date: day(sub.trial_ends_at) });
      break;
    case 'active':
      icon = 'success'; title = t('subscription.strip_active', { date: day(sub.expires_at) }); body = t('subscription.strip_active_sub');
      break;
    case 'pending':
      icon = 'card'; tone = colors.warningDark; bg = colors.warningLight;
      title = forAssistant + t('subscription.strip_pending', { price: n(sub.price) }); body = t('subscription.strip_pending_sub', { count: days, date: day(sub.late_at) });
      break;
    case 'late':
      icon = 'warning'; tone = colors.danger; bg = colors.dangerLight;
      title = forAssistant + t('subscription.strip_late', { price: n(sub.price) }); body = t('subscription.strip_late_sub', { count: days, date: day(sub.block_at) });
      break;
    case 'blocked':
      icon = 'lock'; tone = colors.danger; bg = colors.dangerLight;
      title = forAssistant + t('subscription.phase_blocked'); body = t('subscription.paid_hint');
      break;
    default:
      icon = 'late'; tone = colors.textSecondary; bg = colors.surface;
      title = t('subscription.phase_lapsed'); body = t('subscription.strip_lapsed_sub', { days: p.grace_days });
  }

  return (
    <TouchableOpacity
      onPress={() => router.push('/(teacher)/subscription' as Href)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, ...shadows.sm }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, textAlign: 'right' }} numberOfLines={2}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: 2, lineHeight: 18 }} numberOfLines={2}>{body}</Text>
      </View>
      <Icon name="back" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}
