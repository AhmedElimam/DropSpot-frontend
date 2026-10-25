import { View, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';

const HIDDEN_ON = ['/login', '/register', '/verify', '/forgot-password', '/reset-password', '/welcome', '/accept-terms', '/change-password', '/subscription', '/subscription-wall', '/impersonate', '/invite'];

/**
 * The trial, quietly, everywhere (founder 2026-10-25: «in terms of trial show it across the whole
 * app on the right bottom corner with opacity that doesn't block the teacher from clicking
 * anything»): a small see-through tag in the bottom-right corner, above the tab bar, on every
 * teacher screen while the trial runs. Touches pass through it (pointerEvents none) — it is
 * information, not a button; the home and settings carry the way to the subscription page.
 * Not on the auth screens, nor on the subscription page itself. Teachers only.
 */
export function TrialCornerTag() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sub = useAuthStore((s) => s.user?.subscription ?? null);
  const role = useAuthStore((s) => s.role);
  const pathname = usePathname() ?? '';
  if (role !== 'teacher' || !sub || sub.phase !== 'trial' || sub.enroll_locked) return null;
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  const days = sub.days_left ?? 0;
  const label = days > 0 ? t('subscription.trial_corner', { n: formatNumber(days) }) : t('subscription.trial_corner_last');

  return (
    <Surface id="teacher.trial_corner">
      {/* `start` is the right edge under the app's forced RTL. */}
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', start: spacing.md, bottom: nav.bottomHeight + insets.bottom + spacing.sm, opacity: 0.72, zIndex: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryDark, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Icon name="star" size={13} color="#F2C14E" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>{label}</Text>
        </View>
      </View>
    </Surface>
  );
}
