import { View, Text } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { radius, spacing, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { Surface } from '@/ui/surfaces';
import { subscriptionNotice, useSubscriptionBannerStore } from './subscriptionNotice';

const HIDDEN_ON = ['/login', '/register', '/verify', '/forgot-password', '/reset-password', '/welcome', '/accept-terms', '/change-password', '/subscription', '/subscription-wall', '/impersonate', '/invite'];
const FILL: Record<string, string> = { trial: '#1E2657', lapsed: '#1E2657', locked: '#1E2657', pending: '#8A6109', late: '#A82C3C', blocked: '#A82C3C' };
const GLYPH: Record<string, string> = { trial: '#F2C14E', lapsed: '#FFFFFF', locked: '#FFFFFF', pending: '#FFE3A3', late: '#FFD0D6', blocked: '#FFD0D6' };

/**
 * The subscription, quietly, everywhere (founder 2026-10-25: «show it across the whole app on the
 * right bottom corner with opacity that doesn't block the teacher from clicking anything» — first
 * the trial, then «the status if the subscription is not cleared, like the trial»): a small
 * see-through tag in the bottom-right corner, above the tab bar, on every teacher screen —
 * the trial's days in navy, an open bill in amber, a late one in red, the bill on its way or the
 * freeze in navy. Nothing for a paid or exempt account. Touches pass through it (pointerEvents
 * none); the home banner and settings carry the way to the page. It steps aside while the home
 * banner is up. Not on the auth screens, nor on the subscription page. Teachers only.
 */
export function SubscriptionCornerTag() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sub = useAuthStore((s) => s.user?.subscription ?? null);
  const role = useAuthStore((s) => s.role);
  const bannerUp = useSubscriptionBannerStore((s) => s.open);
  const pathname = usePathname() ?? '';
  if (role !== 'teacher' || bannerUp) return null;
  const notice = subscriptionNotice(sub, t);
  if (!notice || notice.kind === 'blocked') return null; // walled: the wall says it
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <Surface id="teacher.trial_corner">
      {/* `start` is the right edge under the app's forced RTL. */}
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', start: spacing.md, bottom: nav.bottomHeight + insets.bottom + spacing.sm, opacity: 0.74, zIndex: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: FILL[notice.kind], borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Icon name={notice.icon} size={13} color={GLYPH[notice.kind]} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>{notice.corner}</Text>
        </View>
      </View>
    </Surface>
  );
}
