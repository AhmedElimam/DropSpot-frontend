import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, type StyleProp, type ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useOnScreen } from '@/hooks/useAmbientMotion';
import { usePopupSlotStore } from '@/ui/popupSlot';
import { subscriptionNotice, useSubscriptionBannerStore } from './subscriptionNotice';

/** How long the banner stays on the home before it folds away by itself. */
const SHOW_MS = 8000;
const FOLD = {
  duration: 260,
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};
/** Accounts whose banner already folded since the app was opened — once per opening. */
const foldedThisLaunch = new Set<string>();

/**
 * The subscription on the teacher's home, when something needs doing — a bill, a late one, the
 * wall, the bill on its way, the freeze (founder 2026-10-25: «it takes a big chunk of the page,
 * make it automatically dismissable»). One compact row in the bill's colour: icon, title, the
 * amount and the date that matters, ×. It folds away by itself after SHOW_MS in view — a thin
 * line underneath runs down the time — or at ×, and stays folded until the app is opened again;
 * the corner tag (SubscriptionCornerTag) keeps the reminder meanwhile. Paid, exempt, trial:
 * nothing here. From the session's subscription copy (kept fresh by SubscriptionSync).
 */
export function SubscriptionStrip({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const sub = useAuthStore((s) => s.user?.subscription ?? null);
  const userId = useAuthStore((s) => s.user?.id);
  const role = useAuthStore((s) => s.role);
  // Its clock runs only while the home is in front AND nothing covers it — a popup (her status
  // sheet at app open), a sheet or an alert; else it folded unseen behind them.
  const covered = usePopupSlotStore((s) => s.holder !== null || s.others > 0);
  const onScreen = useOnScreen() && !covered;
  const notice = subscriptionNotice(sub, t);
  const key = `${userId}:${notice?.kind ?? ''}`;
  const [folded, setFolded] = useState(() => foldedThisLaunch.has(key));
  const forAssistant = role === 'assistant';
  const shown = !!notice && notice.kind !== 'trial' && !folded
    && (!forAssistant || notice.kind === 'pending' || notice.kind === 'late' || notice.kind === 'blocked' || notice.kind === 'locked');

  useEffect(() => { setFolded(foldedThisLaunch.has(key)); }, [key]);
  useEffect(() => {
    useSubscriptionBannerStore.setState({ open: shown });
    return () => useSubscriptionBannerStore.setState({ open: false });
  }, [shown]);

  const fold = useCallback(() => {
    foldedThisLaunch.add(key);
    LayoutAnimation.configureNext(FOLD);
    setFolded(true);
  }, [key]);

  // The time left, as a line that runs down — only while the home is in front of you.
  const left = useSharedValue(1);
  useEffect(() => {
    if (!shown || !onScreen) { cancelAnimation(left); left.value = 1; return; }
    left.value = 1;
    left.value = withTiming(0, { duration: SHOW_MS, easing: Easing.linear }, (done) => { if (done) runOnJS(fold)(); });
    return () => cancelAnimation(left);
  }, [shown, onScreen, left, fold]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: left.value }] }));

  if (!shown || !notice) return null;
  const open = () => { fold(); router.push('/(teacher)/subscription' as Href); };

  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: notice.tint, overflow: 'hidden', ...shadows.sm }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={open} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${notice.title}. ${notice.line}`}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, paddingStart: spacing.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: notice.tint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={notice.icon} size={17} color={notice.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>
              {forAssistant ? t('subscription.strip_for_assistant') : ''}{notice.title}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: notice.ink, marginTop: 1 }} numberOfLines={1}>{notice.line}</Text>
          </View>
          {forAssistant ? null : <Icon name="back" size={16} color={colors.textTertiary} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={fold} accessibilityRole="button" accessibilityLabel={t('subscription.banner_close')} hitSlop={8}
          style={{ width: 40, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      {/* The time before it folds away by itself. */}
      <Animated.View style={[{ height: 2, backgroundColor: notice.ink, opacity: 0.55, transformOrigin: 'right' }, bar]} />
    </View>
  );
}
