import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Platform, Share, RefreshControl, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from '@/components/ui/Refreshable';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { ErrorState } from '@/components/ui/ErrorState';
import { Surface } from '@/ui/surfaces';
import { useReferral } from '@/hooks/useReferral';
import { referralLinks, referralShareText, referralTerms, type ReferralInfo } from '@/api/referral';
import { formatNumber } from '@/utils/format';

/**
 * «ادعُ معلّمًا» (founder 2026-11-17): a founding teacher's invite code, the link it opens, and
 * one tap to send it — WhatsApp, Messenger, SMS or the phone's own share sheet. The teacher
 * they invite signs up on the website and gets the trial plus a discount on the first bill.
 * No clipboard module ships in this build (OTA only, no new native code): the code and the
 * link are selectable text instead, and «مشاركة» covers «نسخ» on both systems.
 */
export default function ReferralScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const q = useReferral();
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);
  const info = q.data;

  const card: ViewStyle = { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm };

  return (
    <Surface id="screen.teacher.referral" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <PageHero title={t('referral.title')} subtitle={t('referral.hero_sub')} onBack />
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          {q.isLoading ? (
            <View style={{ ...card, alignItems: 'center', paddingVertical: spacing.xl }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !info ? (
            <View style={card}>
              <ErrorState message={t('referral.load_failed')} onRetry={() => { void q.refetch(); }} />
            </View>
          ) : !info.available ? (
            <Surface id="teacher.referral.unavailable">
            <View style={{ ...card, alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="gift" size={26} color={colors.brand} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center' }}>{t('referral.unavailable_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{t('referral.unavailable_body')}</Text>
              <Button title={t('common.back')} variant="outline" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
            </View>
            </Surface>
          ) : (
            <ReferralContent info={info} card={card} />
          )}
        </View>
      </ScrollView>
    </View>
    </Surface>
  );
}

function ReferralContent({ info, card }: { info: ReferralInfo; card: ViewStyle }) {
  const { t } = useTranslation();
  const terms = referralTerms(info);
  const n = (v: number | null | undefined) => formatNumber(Number(v ?? 0), { maximumFractionDigits: 0 });
  const message = referralShareText(info, t);
  const url = info.url ?? '';
  const links = referralLinks(message, url, Platform.OS);

  const shareSheet = async () => {
    try { await Share.share({ message }); } catch { /* dismissed */ }
  };
  // Try each link in turn; an app that is not installed rejects, and the phone's share sheet
  // is the last resort so a tap always sends something.
  const openFirst = async (urls: string[]) => {
    for (const u of urls) {
      try { await Linking.openURL(u); return; } catch { /* next */ }
    }
    await shareSheet();
  };

  return (
    <>
      {/* The code, big, and the link it opens */}
      <Surface id="teacher.referral.code_card">
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="gift" size={20} color="#FFFFFF" />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: 'rgba(255,255,255,0.86)' }} numberOfLines={1}>{t('referral.your_code')}</Text>
        </View>
        <Text selectable style={{ fontFamily: fonts.bold, fontSize: 36, lineHeight: 48, letterSpacing: 2, color: '#FFFFFF', marginTop: spacing.md, textAlign: 'center' }}
          numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`${t('referral.your_code')}: ${info.code ?? ''}`}>{info.code}</Text>
        {url ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 }}>
            <Icon name="link" size={16} color="rgba(255,255,255,0.86)" />
            <Text selectable style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: '#FFFFFF' }} numberOfLines={1} ellipsizeMode="middle">{url}</Text>
          </View>
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: 'rgba(255,255,255,0.9)', marginTop: spacing.md }}>
          {t('referral.offer', { days: n(terms.trialDays), min: n(terms.min), max: n(terms.max) })}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{t('referral.reward_note')}</Text>
      </LinearGradient>
      </Surface>

      {/* One tap to send it */}
      <Surface id="teacher.referral.share">
      <View style={card}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('referral.share_title')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <ShareButton icon="whatsapp" tint={colors.whatsapp} bg={colors.successLight} label={t('referral.share_whatsapp')}
            onPress={() => openFirst([links.whatsapp, info.whatsapp_url || links.whatsappWeb])} />
          <ShareButton icon="facebook" tint={colors.info} bg={colors.infoLight} label={t('referral.share_messenger')}
            onPress={() => openFirst([links.messenger])} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <ShareButton icon="sms" tint={colors.accent} bg={colors.accentLight} label={t('referral.share_sms')}
            onPress={() => openFirst([links.sms])} />
          <ShareButton icon="share" tint={colors.brand} bg={colors.brandTint} label={t('referral.share_more')}
            onPress={() => { void shareSheet(); }} />
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: spacing.sm }}>{t('referral.copy_hint')}</Text>
      </View>
      </Surface>

      {/* How the invitations went */}
      <Surface id="teacher.referral.stats">
      <View style={card}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('referral.stats_title')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Stat value={n(info.invited)} label={t('referral.stat_invited')} tint={colors.brand} bg={colors.brandTint} />
          <Stat value={n(info.activated)} label={t('referral.stat_activated')} tint={colors.successText} bg={colors.successLight} />
          <Stat value={n(info.pending)} label={t('referral.stat_pending')} tint={colors.warningText} bg={colors.warningLight} />
        </View>
      </View>
      </Surface>
    </>
  );
}

function ShareButton({ icon, tint, bg, label, onPress }: { icon: IconName; tint: string; bg: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={tint} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ value, label, tint, bg }: { value: string; label: string; tint: string; bg: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', borderRadius: radius.lg, backgroundColor: bg, paddingVertical: spacing.md, paddingHorizontal: spacing.xs }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: tint }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{label}</Text>
    </View>
  );
}
