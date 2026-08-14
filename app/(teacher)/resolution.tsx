import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { TeacherTip } from '@/components/TeacherTip';
import {
  getResolutionSummary, getPendingExcuses, getPendingSwaps,
  approveExcuse, rejectExcuse, approveSwap, rejectSwap,
  type ExcuseItem, type SwapItem,
} from '@/api/resolution';

/**
 * Resolution Center — the teacher's consolidated review hub. Aggregates the review
 * queues that were previously web-only (absence excuses, session-swap requests) with
 * inline approve/reject, plus a link into tickets. Mirrors the web needs-attention pattern.
 */
export default function ResolutionCenter() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const summary = useQuery({ queryKey: ['resolution-summary'], queryFn: getResolutionSummary });
  const excuses = useQuery({ queryKey: ['resolution-excuses'], queryFn: getPendingExcuses });
  const swaps = useQuery({ queryKey: ['resolution-swaps'], queryFn: getPendingSwaps });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['resolution-summary'] });
    qc.invalidateQueries({ queryKey: ['resolution-excuses'] });
    qc.invalidateQueries({ queryKey: ['resolution-swaps'] });
  };

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      refetchAll();
    } catch {
      Alert.alert(t('common.error'), t('resolution.action_failed'));
    } finally {
      setBusy(null);
    }
  };

  const loading = summary.isLoading || excuses.isLoading || swaps.isLoading;
  const refreshing = summary.isRefetching || excuses.isRefetching || swaps.isRefetching;
  const s = summary.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.resolution_title')}</Text>
      </View>

      <TeacherTip
        tip="reports"
        icon="reports"
        titleKey="onboarding.tip_reports_title"
        bodyKey="onboarding.tip_reports_body"
        bulletKeys={['onboarding.tip_reports_b1']}
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={colors.primary} />}
        >
          {/* Summary tiles */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <SummaryTile label={t('resolution.excuses')} value={s?.excuses ?? 0} />
            <SummaryTile label={t('resolution.swaps')} value={s?.swaps ?? 0} />
            <SummaryTile label={t('resolution.tickets')} value={s?.tickets ?? 0} />
          </View>

          {(s?.total ?? 0) === 0 ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <Icon name="bell" size={40} color={colors.textTertiary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md }}>{t('resolution.all_clear')}</Text>
            </View>
          ) : null}

          {/* Excuses */}
          {excuses.data && excuses.data.length > 0 ? (
            <>
              <SectionTitle>{t('resolution.excuses')}</SectionTitle>
              {excuses.data.map((e: ExcuseItem) => (
                <ReviewCard
                  key={`ex-${e.id}`}
                  title={e.student_name}
                  subtitle={[e.course_name, e.reason].filter(Boolean).join(' · ')}
                  busy={busy === `ex-${e.id}`}
                  onApprove={() => act(`ex-${e.id}`, () => approveExcuse(e.id))}
                  onReject={() => act(`ex-${e.id}`, () => rejectExcuse(e.id))}
                  t={t}
                />
              ))}
            </>
          ) : null}

          {/* Swaps */}
          {swaps.data && swaps.data.length > 0 ? (
            <>
              <SectionTitle>{t('resolution.swaps')}</SectionTitle>
              {swaps.data.map((sw: SwapItem) => (
                <ReviewCard
                  key={`sw-${sw.id}`}
                  title={sw.student_name}
                  subtitle={[sw.to_course, sw.remaining != null ? t('resolution.remaining', { n: sw.remaining }) : null].filter(Boolean).join(' · ')}
                  busy={busy === `sw-${sw.id}`}
                  onApprove={() => act(`sw-${sw.id}`, () => approveSwap(sw.id))}
                  onReject={() => act(`sw-${sw.id}`, () => rejectSwap(sw.id))}
                  t={t}
                />
              ))}
            </>
          ) : null}

          {/* Tickets — link out to the existing tickets surface */}
          {(s?.tickets ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('resolution.tickets')}</SectionTitle>
              <TouchableOpacity onPress={() => router.push('/(teacher)/tickets' as Href)} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brand + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="tickets" size={22} color={colors.brand} />
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('resolution.open_tickets', { n: s?.tickets ?? 0 })}</Text>
                <Icon name="back" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: value > 0 ? colors.brand : colors.textTertiary }}>{value}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.xl, marginBottom: spacing.sm }}>{children}</Text>;
}

function ReviewCard({ title, subtitle, busy, onApprove, onReject, t }: {
  title: string; subtitle: string; busy: boolean; onApprove: () => void; onReject: () => void; t: (k: string) => string;
}) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
      {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity onPress={onReject} disabled={busy} activeOpacity={0.85}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{t('resolution.reject')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onApprove} disabled={busy} activeOpacity={0.85}
          style={{ flex: 2, backgroundColor: colors.success, borderRadius: radius.md, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('resolution.approve')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
