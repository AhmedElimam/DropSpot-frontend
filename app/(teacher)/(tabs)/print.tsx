import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients, shadows, isDark } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { IS_STAGING } from '@/config/env';
import { PrintTabJobCard } from '@/components/print/PrintTabJobCard';
import { PrintTabShopsStrip } from '@/components/print/PrintTabShopsStrip';
import { PrintTabPastRow } from '@/components/print/PrintTabPastRow';
import { PrintTabHowItWorks } from '@/components/print/PrintTabHowItWorks';
import { PrintTabCreditCard } from '@/components/print/PrintTabCreditCard';
import { useAuthStore } from '@/stores/authStore';
import { BetaLine } from '@/components/ui/Beta';
import { getPrintJobs, getPrintShops, getPrintCredit, reorderPrintJob, type PrintJob } from '@/api/print';

const money = (v: number) => formatNumber(v, { maximumFractionDigits: v % 1 ? 2 : 0 });

// The hero is deep ink in BOTH schemes (founder: no washed tops), so what sits on it is white.
const ON = '#FFFFFF';
const ON_SOFT = 'rgba(255,255,255,0.74)';
const GLASS = 'rgba(255,255,255,0.10)';
const GLASS_BORDER = 'rgba(255,255,255,0.16)';

/** A section's title, an optional count, and an optional «عرض الكل». */
function SectionHead({ title, count, link, onLink }: { title: string; count?: number; link?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{title}</Text>
      {count ? (
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 16, color: colors.onAccent }}>{formatNumber(count)}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {link && onLink ? (
        <TouchableOpacity onPress={onLink} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{link}</Text>
          <Icon name="back" size={14} color={colors.brand} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * «المطبعة» — the teacher's print tab (founder 2026-10-14: «put some love on the printing tab»),
 * laid out like a delivery app's home: an ink hero with the month in three glass chips and
 * the one big «اطبع ملف جديد», then what is on its way, how it works (first time only), the
 * shops by their work, and the past jobs one tap from printing again.
 */
export default function PrintTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const qc = useQueryClient();
  // Polled only while this tab is in front: hidden tabs stay mounted (not frozen), and a 30 s
  // poll of the whole job list from another tab was a radio wake-up and a cache write for nothing.
  const jobs = useQuery({ queryKey: ['print-jobs'], queryFn: getPrintJobs, refetchInterval: focused ? 30_000 : false });
  const shops = useQuery({ queryKey: ['print-shops'], queryFn: getPrintShops });
  // «سجل الدفع» — money: the teacher's alone, never fetched for an assistant.
  const isAssistant = useAuthStore((st) => st.role === 'assistant');
  const credit = useQuery({ queryKey: ['print-credit'], queryFn: getPrintCredit, enabled: !isAssistant, staleTime: 60_000 });
  const { refreshing, onRefresh } = usePullRefresh(jobs.refetch, shops.refetch, () => (isAssistant ? Promise.resolve() : credit.refetch()));
  const [busy, setBusy] = useState<number | null>(null);

  const open = jobs.data?.open ?? [];
  const closed = jobs.data?.closed ?? [];
  const list = shops.data?.shops ?? [];
  // Every job she sent — the strip counts which shops she already prints at.
  const everyJob = useMemo(() => [...open, ...closed], [open, closed]);
  const month = useMemo(() => {
    const now = new Date();
    const mine = [...open, ...closed].filter((j) => j.sent_at && new Date(j.sent_at).getMonth() === now.getMonth() && new Date(j.sent_at).getFullYear() === now.getFullYear() && j.status !== 'cancelled' && j.status !== 'declined');
    return { spent: mine.reduce((a, j) => a + j.total, 0), pages: mine.reduce((a, j) => a + j.pages * j.copies, 0) };
  }, [open, closed]);

  const goNew = () => router.push('/(teacher)/print/shops' as Href);
  const goAll = () => router.push('/(teacher)/print' as Href);
  const again = (j: PrintJob) => Alert.alert(t('print.reorder'), t('print.reorder_confirm', { shop: j.shop.name ?? '' }), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('print.reorder'), onPress: async () => {
      setBusy(j.id);
      try { const n = await reorderPrintJob(j.id); qc.invalidateQueries({ queryKey: ['print-jobs'] }); router.push(`/(teacher)/print/${n.id}` as Href); }
      catch (e: any) { Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.failed')); }
      finally { setBusy(null); }
    } },
  ]);

  // Ink by day; by night the navy, lifted to indigo at the foot so the rounded edge shows.
  const heroFill: readonly [string, string, ...string[]] = isDark() ? [gradients.hero[0], gradients.hero[1], colors.primaryLight] : gradients.auth;
  const firstTime = !jobs.isLoading && !open.length && !closed.length;
  const stats: { k: string; icon: IconName; v: string; l: string; hot?: boolean }[] = [
    { k: 'open', icon: 'delivery', v: formatNumber(open.length), l: t('print.stat_open'), hot: open.length > 0 },
    { k: 'spent', icon: 'money', v: money(month.spent), l: t('print.stat_spent') },
    { k: 'pages', icon: 'document', v: formatNumber(month.pages), l: t('print.stat_pages') },
  ];

  return (
    <Surface id="screen.teacher.print_tab" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {focused ? <StatusBar style="light" /> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {/* hero */}
        <LinearGradient colors={heroFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + (IS_STAGING ? 36 : spacing.md), paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomStartRadius: 28, borderBottomEndRadius: 28, overflow: 'hidden' }}>
          {/* warm glow and a soft disc — depth without a picture */}
          <View pointerEvents="none" style={{ position: 'absolute', top: -90, start: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.accent, opacity: 0.16 }} />
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, end: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: ON, opacity: 0.05 }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 40, end: -18, opacity: 0.07, transform: [{ rotate: '-12deg' }] }}>
            <Icon name="print" size={150} color={ON} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 38, color: ON }}>{t('print.title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: ON_SOFT }} numberOfLines={2}>{t('print.tab_sub')}</Text>
            </View>
            <TouchableOpacity onPress={goAll} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: radius.full, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER }}>
              <Icon name="list" size={15} color={ON} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: ON }}>{t('print.all_jobs')}</Text>
            </TouchableOpacity>
          </View>

          {/* the month, in three glass chips */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {stats.map((k) => (
              <View key={k.k} style={{ flex: 1, backgroundColor: GLASS, borderWidth: 1, borderColor: k.hot ? colors.accent : GLASS_BORDER, borderRadius: radius.lg, paddingVertical: 9, paddingHorizontal: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={k.icon} size={15} color={k.hot ? colors.accent : ON_SOFT} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: ON, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{k.v}</Text>
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: ON_SOFT }} numberOfLines={1}>{k.l}</Text>
              </View>
            ))}
          </View>

          {/* the one button */}
          <Surface id="teacher.print_tab.new">
          <View style={{ marginTop: spacing.lg, borderRadius: radius.xl, ...shadows.md }}>
            <TouchableOpacity onPress={goNew} activeOpacity={0.9} accessibilityRole="button" style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
              <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, paddingHorizontal: spacing.md }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="print" size={25} color={colors.onAccent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 26, color: colors.onAccent }}>{t('print.cta_title')}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.onAccent, opacity: 0.9 }} numberOfLines={1}>{t('print.cta_sub')}</Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="back" size={17} color={colors.onAccent} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </Surface>
          {/* The marketplace reached this teacher as a beta (feature targeting): one line, the way to send notes. */}
          <BetaLine feature="print_market" style={{ marginHorizontal: 0, marginTop: spacing.md }} />
        </LinearGradient>

        {/* «سجل الدفع» — the score, the tier, what is left on credit or what is overdue */}
        {credit.data?.on && !isAssistant ? (
          <Surface id="teacher.print_tab.credit" assistantNeeds="teacher">
          <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
            <PrintTabCreditCard c={credit.data} />
          </View>
          </Surface>
        ) : null}

        {/* on its way */}
        {open.length ? (
          <Surface id="teacher.print_tab.open">
          <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
            <SectionHead title={t('print.on_the_way')} count={open.length} />
            {open.map((j) => <PrintTabJobCard key={j.id} j={j} />)}
          </View>
          </Surface>
        ) : null}

        {/* first time: how a print goes */}
        {firstTime ? (
          <Surface id="teacher.print_tab.how">
          <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
            <PrintTabHowItWorks />
          </View>
          </Surface>
        ) : null}

        {/* the shops, by their work */}
        {list.length ? (
          <Surface id="teacher.print_tab.shops">
            <PrintTabShopsStrip shops={list} jobs={everyJob} onAll={goNew} />
          </Surface>
        ) : null}

        {/* printed before */}
        {closed.length ? (
          <Surface id="teacher.print_tab.past">
          <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
            <SectionHead title={t('print.printed_before')} link={closed.length > 6 ? t('print.see_all') : undefined} onLink={goAll} />
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
              {closed.slice(0, 6).map((j, i, arr) => (
                <PrintTabPastRow key={j.id} j={j} last={i === arr.length - 1} busy={busy === j.id} onAgain={() => again(j)} />
              ))}
            </View>
          </View>
          </Surface>
        ) : null}
      </ScrollView>
    </View>
    </Surface>
  );
}
