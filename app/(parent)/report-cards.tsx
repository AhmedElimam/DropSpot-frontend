import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useReportCards } from '@/hooks/useReportCards';
import { getReportDownloadUrl, type ReportCard } from '@/api/reports';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const pct = (v: ReportCard['overall_score']): string =>
  v === null || v === undefined || v === '' ? '—' : `${Math.round(Number(v))}%`;

/**
 * Parent report cards (§3) — the periodic performance reports the backend generates
 * on every completed billing cycle, each downloadable as an Arabic PDF. Distinct
 * from the aggregate attendance/grades dashboard in reports.tsx. Optionally filtered
 * to one child via ?studentId= when opened from child detail.
 */
export default function ReportCardsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const { data: reports, isLoading } = useReportCards();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const list = (reports ?? []).filter(
    (r) => !params.studentId || String(r.student_id) === String(params.studentId)
  );

  async function openReport(report: ReportCard) {
    if (openingId) return;
    setOpeningId(report.id);
    try {
      const url = await getReportDownloadUrl(report.id);
      if (!url) throw new Error('no url');
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert(t('reports.open_failed'));
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Icon name="forward" size={22} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginStart: spacing.sm }}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff' }}>{t('reports.report_cards')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
            {t('reports.report_cards_sub')}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />
          ) : list.length === 0 ? (
            <EmptyState icon="reports" title={t('reports.no_reports')} message={t('reports.no_reports_sub')} />
          ) : (
            list.map((r) => (
              <ReportRow key={r.id} report={r} opening={openingId === r.id} onOpen={() => openReport(r)} t={t} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ReportRow({ report, opening, onOpen, t }: {
  report: ReportCard; opening: boolean; onOpen: () => void; t: (k: string) => string;
}) {
  const period = [report.period_start, report.period_end].filter(Boolean).join(' — ');
  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="reports" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }} numberOfLines={1}>
            {report.course_name ?? '—'}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
            {report.student_name ? `${report.student_name} · ` : ''}{report.teacher_name ?? ''}
          </Text>
        </View>
        {report.letter_grade ? (
          <View style={{ minWidth: 40, height: 40, paddingHorizontal: 8, borderRadius: 12, borderWidth: 2, borderColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.brand }}>{report.letter_grade}</Text>
          </View>
        ) : null}
      </View>

      {period ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.md }}>
          {t('reports.period')}: {period}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <ScoreChip label={t('reports.overall')} value={pct(report.overall_score)} />
        <ScoreChip label={t('reports.academic')} value={pct(report.academic_score)} />
        <ScoreChip label={t('reports.attendance')} value={pct(report.attendance_score)} />
      </View>

      <TouchableOpacity
        onPress={onOpen}
        disabled={opening}
        activeOpacity={0.8}
        style={{ flexDirection: 'row', gap: spacing.sm, minHeight: 46, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', opacity: opening ? 0.6 : 1 }}
      >
        {opening ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name="eye" size={18} color="#fff" />
        )}
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>
          {opening ? t('reports.opening') : t('reports.download_pdf')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ScoreChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{value}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
