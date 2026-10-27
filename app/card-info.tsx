import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { NazerFramed } from '@/components/nazer/NazerFramed';
import { CardPerks, CardWhy, CardSteps } from '@/components/cardOrder/CardPerks';
import { getCardOrderTargets } from '@/api/cardOrders';
import { useAuthStore } from '@/stores/authStore';
import { Surface } from '@/ui/surfaces';

/** The gold rule the printed card carries. */
const GOLD = '#C9A227';

/**
 * «كارت دروس سبوت» — what the card is, why a student needs one and how it arrives (founder
 * 2026-10-24: «show the card and know more about it … why you need a card»), for a student or a
 * parent, from the profile tab and the tour's last step. Calm facts, no urgency; the order button
 * shows only when someone in the family can still order one.
 */
export default function CardInfoScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const family = role === 'student' || role === 'parent';
  const { data: targets } = useQuery({ queryKey: ['card-order-targets'], queryFn: getCardOrderTargets, enabled: family });
  const canOrder = (targets ?? []).some((x) => x.can_order && !x.pending_review);

  // Everything the order screen's popup says is on this page: it need not open again.
  useEffect(() => {
    if (user?.id) AsyncStorage.setItem(`card_intro_seen:${user.id}`, '1').catch(() => {});
  }, [user?.id]);

  const order = () => router.push((role === 'parent' ? '/(parent)/order-card' : '/(student)/order-card') as Href);
  const sectionTitle = { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md } as const;
  const panel = { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm } as const;

  return (
    <Surface id="screen.card-info" screen>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('card_info.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl4, gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        {/* The card itself, drawn as it is printed: deep ink, the gold rule, the emblem. */}
        <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
          <LinearGradient colors={gradients.auth} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: '88%', maxWidth: 340, aspectRatio: 1.586, borderRadius: 18, overflow: 'hidden', ...shadows.md }}>
            <View style={{ height: 4, backgroundColor: GOLD }} />
            <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <BrandMark size={26} tint="#FFFFFF" />
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>{t('card_info.card_brand')}</Text>
              </View>
              <View>
                <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 17, color: '#FFFFFF' }}>
                  {role === 'student' && user?.name ? user.name : t('card_info.card_name')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.72)', letterSpacing: 3 }}>
                    {role === 'student' && user?.student_code ? user.student_code : '••••••'}
                  </Text>
                  <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: GOLD }} />
                </View>
              </View>
            </View>
          </LinearGradient>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }}>{t('card_info.headline')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 23, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>{t('card_info.lede')}</Text>
        </View>

        {/* الناظر's word on it. */}
        <View style={[panel, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
          <NazerFramed size={64} blink={false} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('card_order.intro_sub')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 23, color: colors.textPrimary, marginTop: 2 }}>{t('card_info.nazer_quote')}</Text>
          </View>
        </View>

        <View style={panel}>
          <Text style={sectionTitle}>{t('card_info.why_title')}</Text>
          <CardWhy />
        </View>

        <View style={panel}>
          <Text style={sectionTitle}>{t('card_order.perks_title')}</Text>
          <CardPerks />
        </View>

        <View style={panel}>
          <Text style={sectionTitle}>{t('card_info.how_title')}</Text>
          <CardSteps />
        </View>

        {canOrder ? (
          <TouchableOpacity onPress={order} activeOpacity={0.85} accessibilityRole="button"
            style={{ minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Icon name="card" size={18} color={colors.onPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t(role === 'parent' ? 'card_info.cta_parent' : 'card_info.cta_student')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
    </Surface>
  );
}
