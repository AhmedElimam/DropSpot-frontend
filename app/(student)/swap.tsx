import { useState, type ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, layout } from '@/theme/index';
import { formatDate, formatTime } from '@/utils/format';
import { useUpcomingSessions } from '@/hooks/useSessions';
import { useSwapCandidates, useRequestSwap } from '@/hooks/useSwaps';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';

/**
 * Swap-a-session flow, rebuilt to the student-app-screens.html spec: a centred
 * header, the original session in a card, a "بدّل إلى" divider, then the
 * alternate slots as radio rows with a capacity chip, and a fixed confirm bar.
 *
 * Reachable pre-selected via a `sessionId` param (from the check-in screen) or
 * standalone — when no original is chosen we show the same slots as a picker.
 * The request needs the teacher's approval; nothing changes the base schedule.
 */

/** A radio selection row — used for both the original picker and the candidates. */
function Slot({ title, subtitle, trailing, selected, disabled, onPress }: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: selected ? colors.brand : colors.line,
        backgroundColor: selected ? colors.brandWash : colors.surface,
        opacity: disabled ? 0.55 : 1,
        marginBottom: 10,
        ...(selected ? { shadowColor: colors.brand, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.09, shadowRadius: 0, elevation: 0 } : null),
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.brand : colors.line, alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: colors.brand }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </TouchableOpacity>
  );
}

export default function SwapRequestScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(student)');
  };

  const [originalId, setOriginalId] = useState<number | null>(
    params.sessionId ? Number(params.sessionId) : null,
  );
  const [targetId, setTargetId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // The original arrived pre-selected via the route param → no "change" affordance.
  const locked = !!params.sessionId;

  const { data: upcoming, isLoading: upcomingLoading, isError: upcomingError, refetch: refetchUpcoming } = useUpcomingSessions(20);
  const { data: candidates, isLoading: candidatesLoading } = useSwapCandidates(originalId);
  const requestMutation = useRequestSwap();
  const { refreshing, onRefresh } = usePullRefresh(refetchUpcoming);

  const originalSession = (upcoming ?? []).find((s) => s.id === originalId) ?? null;

  const weekdayTime = (iso: string) => `${formatDate(new Date(iso), { weekday: 'long' })} ${formatTime(iso)}`;

  const submit = () => {
    if (!originalId || !targetId) return;
    requestMutation.mutate(
      { original_session_instance_id: originalId, target_session_instance_id: targetId },
      { onSuccess: () => setSubmitted(true) },
    );
  };

  // ---- Success state -------------------------------------------------------
  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.goodWash, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="success" size={40} color={colors.good} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink, textAlign: 'center' }}>{t('swap.pending_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center' }}>
            {t('swap.pending_desc')}
          </Text>
          <TouchableOpacity
            onPress={goBack}
            activeOpacity={0.85}
            style={{ marginTop: spacing.md, height: 48, borderRadius: 15, backgroundColor: colors.brand, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('swap.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const capacityChip = (remaining: number | null) => {
    if (remaining === 0) {
      return <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.danger }}>{t('swap.full')}</Text>;
    }
    if (remaining === null) {
      return <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.good }}>{t('swap.unlimited')}</Text>;
    }
    return <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.good }}>{t('swap.places', { count: remaining })}</Text>;
  };

  const hasOriginal = originalId != null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: insets.top + spacing.sm, paddingBottom: 96 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header — back · centred title · spacer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginBottom: spacing.sm }}>
          <TouchableOpacity onPress={goBack} accessibilityRole="button" style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={18} color={colors.ink} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.ink }}>{t('swap.title')}</Text>
          <View style={{ width: 42 }} />
        </View>

        {hasOriginal ? (
          <>
            {/* Original session */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 11, marginHorizontal: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{t('swap.original_session')}</Text>
              {!locked ? (
                <TouchableOpacity onPress={() => { setOriginalId(null); setTargetId(null); }} hitSlop={8}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.brand }}>{t('swap.change')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, ...shadows.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 15 }}>
              <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandWash, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="clock" size={18} color={colors.brand} outline />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>
                  {originalSession ? `${originalSession.course_name ?? '—'} — ${weekdayTime(originalSession.scheduled_at)}` : t('swap.original_session')}
                </Text>
                {originalSession?.teacher_name ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                    {originalSession.location ? `${originalSession.teacher_name} · ${originalSession.location}` : originalSession.teacher_name}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 16, marginHorizontal: 2 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.muted }}>{t('swap.swap_to')}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            </View>

            {/* Candidate slots */}
            {candidatesLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={64} radius={18} />
                <Skeleton height={64} radius={18} />
              </View>
            ) : !candidates || candidates.length === 0 ? (
              <EmptyState icon="calendar" title={t('swap.no_candidates')} />
            ) : (
              candidates.map((c) => (
                <Slot
                  key={c.id}
                  title={weekdayTime(c.scheduled_at)}
                  subtitle={c.teacher_name ?? t('swap.same_course_teacher')}
                  trailing={capacityChip(c.remaining_capacity)}
                  selected={targetId === c.id}
                  disabled={c.remaining_capacity === 0}
                  onPress={() => setTargetId(c.id)}
                />
              ))
            )}

            {/* One-time notice */}
            <View style={{ marginTop: 6, backgroundColor: colors.warnWash, borderWidth: 1, borderColor: '#F7E1C6', borderRadius: radius.card, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 15 }}>
              <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="warning" size={18} color={colors.warn} outline />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{t('swap.one_time_title')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('swap.one_time_desc')}</Text>
              </View>
            </View>

            {requestMutation.isError ? (
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginTop: spacing.md, textAlign: 'center' }}>{t('swap.error')}</Text>
            ) : null}
          </>
        ) : (
          <>
            {/* Picker — choose the original when arriving standalone */}
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 4, marginBottom: 11, marginHorizontal: 2 }}>{t('swap.choose_original')}</Text>
            {upcomingLoading ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={64} radius={18} />
                <Skeleton height={64} radius={18} />
                <Skeleton height={64} radius={18} />
              </View>
            ) : upcomingError ? (
              <ErrorState onRetry={() => refetchUpcoming()} />
            ) : !upcoming || upcoming.length === 0 ? (
              <EmptyState icon="calendar" title={t('swap.no_upcoming')} />
            ) : (
              upcoming.map((s) => (
                <Slot
                  key={s.id}
                  title={`${s.course_name ?? '—'} — ${weekdayTime(s.scheduled_at)}`}
                  subtitle={s.teacher_name ?? undefined}
                  onPress={() => { setOriginalId(s.id); setTargetId(null); }}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Fixed confirm bar — only once a target is picked */}
      {hasOriginal ? (
        <View style={{ position: 'absolute', right: 0, left: 0, bottom: 0, paddingHorizontal: layout.screenPadding, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }}>
          <TouchableOpacity
            onPress={submit}
            disabled={!targetId || requestMutation.isPending}
            activeOpacity={0.85}
            style={{ height: 48, borderRadius: 15, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', opacity: !targetId || requestMutation.isPending ? 0.5 : 1 }}
          >
            {requestMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#fff' }}>{t('swap.confirm')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
