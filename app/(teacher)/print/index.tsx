import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen, HeaderAction } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber } from '@/utils/format';
import { Surface } from '@/ui/surfaces';
import { getPrintJobs, type PrintJob } from '@/api/print';

const TONE = (): Record<PrintJob['status_tone'], { bg: string; fg: string }> => ({
  warning: { bg: colors.warningLight, fg: colors.warningText },
  info: { bg: colors.brandTint, fg: colors.brand },
  success: { bg: colors.successLight, fg: colors.successText },
  danger: { bg: colors.dangerLight, fg: colors.dangerText },
  gray: { bg: colors.surfaceSunken, fg: colors.textSecondary },
});

/** One job on the list: title, shop, what it is, where it stands, what it costs. */
function JobRow({ j }: { j: PrintJob }) {
  const { t } = useTranslation();
  const tone = TONE()[j.status_tone];
  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/print/${j.id}` as Href)} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: tone.fg, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="print" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{j.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
            {j.shop.name ?? ''} · {t('print.copies_x_pages', { copies: formatNumber(j.copies), pages: formatNumber(j.pages) })}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{formatNumber(j.total, { maximumFractionDigits: 2 })} {t('teacher.egp')}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: tone.bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tone.fg }}>{j.status_label}</Text>
        </View>
        {j.payment_status !== 'paid' && j.is_open ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningDark }}>{j.payment_label}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * «المطبعة» — the teacher's print jobs, open first. «طلب جديد» opens the composer, where
 * every live shop prices the exact job before one is picked.
 */
export default function PrintJobs() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const jobs = useQuery({ queryKey: ['print-jobs'], queryFn: getPrintJobs });
  const { refreshing, onRefresh } = usePullRefresh(jobs.refetch);
  const open = jobs.data?.open ?? [];
  const closed = jobs.data?.closed ?? [];
  const goNew = () => router.push('/(teacher)/print/new' as Href);

  return (
    <Surface id="screen.teacher.print" screen>
    <FormScreen title={t('print.title')} subtitle={t('print.subtitle')} scroll={false}
      right={<Surface id="teacher.print.new_button"><HeaderAction icon="add" label={t('print.new')} onPress={goNew} /></Surface>}>
      {jobs.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {open.length === 0 && closed.length === 0 ? (
            <Surface id="teacher.print.empty">
              <EmptyState icon="print" title={t('print.empty_title')} message={t('print.empty_hint')} />
              <Button title={t('print.new')} onPress={goNew} style={{ marginTop: spacing.md }} />
            </Surface>
          ) : null}
          {open.length > 0 ? (
            <Surface id="teacher.print.open">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('print.open_jobs')}</Text>
              {open.map((j) => <JobRow key={j.id} j={j} />)}
            </Surface>
          ) : null}
          {closed.length > 0 ? (
            <Surface id="teacher.print.closed">
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('print.closed_jobs')}</Text>
              {closed.map((j) => <JobRow key={j.id} j={j} />)}
            </Surface>
          ) : null}
        </ScrollView>
      )}
    </FormScreen>
    </Surface>
  );
}
