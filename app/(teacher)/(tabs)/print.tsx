import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { getPrintJobs, getPrintShops, reorderPrintJob, sampleSource, type PrintJob, type MarketShop } from '@/api/print';

const money = (v: number) => formatNumber(v, { maximumFractionDigits: v % 1 ? 2 : 0 });

/** A job on its way: what, where it stands, the driver and the minutes — tap to watch the map. */
function LiveJob({ j }: { j: PrintJob }) {
  const { t } = useTranslation();
  const moving = !!j.delivery?.is_active;
  const steps = ['sent', 'accepted', 'printing', 'ready', 'delivered'];
  const at = Math.max(0, steps.indexOf(j.status));
  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/print/${j.id}` as Href)} activeOpacity={0.9} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: moving ? colors.accent : colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: moving ? colors.accent : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={moving ? 'gps' : 'print'} size={23} color={moving ? colors.onAccent : colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{j.title}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: moving ? colors.accentText : colors.textSecondary }} numberOfLines={1}>
            {moving
              ? [j.delivery!.label, j.delivery!.driver, j.delivery!.eta_min ? t('print.track_eta', { m: formatNumber(j.delivery!.eta_min) }) : null].filter(Boolean).join(' · ')
              : `${j.shop.name ?? ''} · ${j.status_label}`}
          </Text>
        </View>
        <Icon name="back" size={16} color={colors.textTertiary} />
      </View>
      {/* the walk, as five bars */}
      <View style={{ flexDirection: 'row', gap: 4, marginTop: spacing.sm }}>
        {steps.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= at ? (moving ? colors.accent : colors.brand) : colors.borderLight }} />)}
      </View>
    </TouchableOpacity>
  );
}

/** A shop as a photo card in the strip: its work first, then name, stars, price. */
function ShopTile({ s }: { s: MarketShop }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/print/shops/${s.vendor_id}` as Href)} activeOpacity={0.9} accessibilityRole="button"
      style={{ width: 200, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {s.cover ? (
        <Image source={sampleSource(s.cover.url)} style={{ width: '100%', height: 110, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={150} recyclingKey={String(s.cover.id)} />
      ) : (
        <LinearGradient colors={gradients.hero} style={{ height: 110, alignItems: 'center', justifyContent: 'center' }}><Icon name="storefront" size={34} color={colors.onHeroSoft} /></LinearGradient>
      )}
      <View style={{ padding: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{s.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: s.rating != null ? colors.warningText : colors.accentText }}>{s.rating != null ? `★ ${formatNumber(s.rating, { maximumFractionDigits: 1 })}` : t('print.new_shop_short')}</Text>
          {s.price_from.bw != null ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>{t('print.from_per_page', { p: money(s.price_from.bw) })}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * «المطبعة» — the teacher's print tab (founder 2026-10-14: «put some love on the printing tab
 * … and the place of this tab»). What is on its way first, then a new print, the shops with
 * their work, and the past jobs one tap from printing again.
 */
export default function PrintTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const jobs = useQuery({ queryKey: ['print-jobs'], queryFn: getPrintJobs, refetchInterval: 30_000 });
  const shops = useQuery({ queryKey: ['print-shops'], queryFn: getPrintShops });
  const { refreshing, onRefresh } = usePullRefresh(jobs.refetch, shops.refetch);
  const [busy, setBusy] = useState<number | null>(null);

  const open = jobs.data?.open ?? [];
  const closed = jobs.data?.closed ?? [];
  const list = shops.data?.shops ?? [];
  const month = useMemo(() => {
    const now = new Date();
    const mine = [...open, ...closed].filter((j) => j.sent_at && new Date(j.sent_at).getMonth() === now.getMonth() && new Date(j.sent_at).getFullYear() === now.getFullYear() && j.status !== 'cancelled' && j.status !== 'declined');
    return { spent: mine.reduce((a, j) => a + j.total, 0), pages: mine.reduce((a, j) => a + j.pages * j.copies, 0) };
  }, [open, closed]);

  const goNew = () => router.push('/(teacher)/print/shops' as Href);
  const again = (j: PrintJob) => Alert.alert(t('print.reorder'), t('print.reorder_confirm', { shop: j.shop.name ?? '' }), [
    { text: t('common.back'), style: 'cancel' },
    { text: t('print.reorder'), onPress: async () => {
      setBusy(j.id);
      try { const n = await reorderPrintJob(j.id); qc.invalidateQueries({ queryKey: ['print-jobs'] }); router.push(`/(teacher)/print/${n.id}` as Href); }
      catch (e: any) { Alert.alert(t('common.error'), e?.response?.data?.message ?? t('print.failed')); }
      finally { setBusy(null); }
    } },
  ]);

  const steps: { icon: IconName; label: string }[] = [
    { icon: 'storefront', label: t('print.how_1') },
    { icon: 'document', label: t('print.how_2') },
    { icon: 'gps', label: t('print.how_3') },
  ];

  return (
    <Surface id="screen.teacher.print_tab" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {/* hero */}
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl + 28, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.onHero }}>{t('print.title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.onHeroSoft, marginTop: 2 }}>{t('print.tab_sub')}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(teacher)/print' as Href)} accessibilityRole="button" style={{ paddingHorizontal: 12, height: 34, borderRadius: radius.full, backgroundColor: colors.onHeroChip, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.onHero }}>{t('print.all_jobs')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {[
              { v: formatNumber(open.length), l: t('print.stat_open') },
              { v: `${money(month.spent)}`, l: t('print.stat_spent') },
              { v: formatNumber(month.pages), l: t('print.stat_pages') },
            ].map((k) => (
              <View key={k.l} style={{ flex: 1, backgroundColor: colors.onHeroChip, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.onHero }}>{k.v}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.onHeroSoft }} numberOfLines={1}>{k.l}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -28 }}>
          {/* the one button */}
          <Surface id="teacher.print_tab.new">
          <TouchableOpacity onPress={goNew} activeOpacity={0.92} accessibilityRole="button"
            style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, shadowColor: '#0A0E27', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="print" size={28} color={colors.onAccent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('print.cta_title')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>{t('print.cta_sub')}</Text>
              </View>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm }}>
              {steps.map((s, i) => (
                <View key={s.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 8 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accentText }}>{formatNumber(i + 1)}</Text>
                  <Icon name={s.icon} size={14} color={colors.textSecondary} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>{s.label}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
          </Surface>

          {/* on its way */}
          {open.length ? (
            <Surface id="teacher.print_tab.open">
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('print.on_the_way')}</Text>
              {open.map((j) => <LiveJob key={j.id} j={j} />)}
            </View>
            </Surface>
          ) : null}
        </View>

        {/* the shops, by their work */}
        {list.length ? (
          <Surface id="teacher.print_tab.shops">
          <View style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('print.shops_strip')}</Text>
              <TouchableOpacity onPress={goNew} accessibilityRole="button" hitSlop={8}><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('print.see_all')}</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              {list.slice(0, 8).map((s) => <ShopTile key={s.vendor_id} s={s} />)}
            </ScrollView>
          </View>
          </Surface>
        ) : null}

        {/* printed before */}
        {closed.length ? (
          <Surface id="teacher.print_tab.past">
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('print.printed_before')}</Text>
            {closed.slice(0, 6).map((j) => (
              <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, marginBottom: 6 }}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/(teacher)/print/${j.id}` as Href)} accessibilityRole="button">
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{j.title}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{j.shop.name ?? ''} · {t('print.copies_x_pages', { copies: formatNumber(j.copies), pages: formatNumber(j.pages) })} · {money(j.total)} {t('teacher.egp')}</Text>
                </TouchableOpacity>
                {j.status === 'received' ? (
                  <TouchableOpacity onPress={() => again(j)} disabled={busy === j.id} accessibilityRole="button" style={{ paddingHorizontal: 12, height: 32, borderRadius: radius.full, backgroundColor: colors.brandTint, justifyContent: 'center', opacity: busy === j.id ? 0.5 : 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('print.again')}</Text>
                  </TouchableOpacity>
                ) : <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{j.status_label}</Text>}
              </View>
            ))}
          </View>
          </Surface>
        ) : null}

        {!jobs.isLoading && !open.length && !closed.length ? (
          <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('print.empty_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 }}>{t('print.empty_hint')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
    </Surface>
  );
}
