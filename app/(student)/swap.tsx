import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { formatDate, formatTime } from '@/utils/format';
import { useUpcomingSessions } from '@/hooks/useSessions';
import { useSwapCandidates, useRequestSwap } from '@/hooks/useSwaps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';

export default function SwapRequestScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Swap is a hidden tab (href:null), so there may be nothing on the stack to pop —
  // router.back() then silently does nothing. Fall back to the dashboard tab.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(student)');
  };

  const [originalId, setOriginalId] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data: upcoming, isLoading: upcomingLoading, isError: upcomingError, isRefetching: upcomingRefetching, refetch: refetchUpcoming } = useUpcomingSessions(20);
  const { data: candidates, isLoading: candidatesLoading } = useSwapCandidates(originalId);
  const requestMutation = useRequestSwap();

  const originalSession = (upcoming ?? []).find((s) => s.id === originalId) ?? null;

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
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#E4F3E8', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="success" size={40} color={colors.success} />
          </View>
          <Text style={[textPresets.h2, { textAlign: 'center' }]}>{t('swap.pending_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center' }}>
            {t('swap.pending_desc')}
          </Text>
          <TouchableOpacity onPress={goBack} activeOpacity={0.85} style={{ marginTop: spacing.md, borderRadius: radius.md, overflow: 'hidden', alignSelf: 'stretch' }}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('swap.done')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const step = originalId ? 2 : 1;

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={upcomingRefetching} onRefresh={refetchUpcoming} tintColor={colors.primary} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xxxl }}
        >
          <TouchableOpacity onPress={goBack} style={{ marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="back" size={20} color="rgba(255,255,255,0.85)" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginStart: 4 }}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>{t('swap.title')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.72)', marginTop: spacing.xs }}>
            {t('swap.subtitle')}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xxl, gap: spacing.md }}>
          {/* STEP 1 — pick the session you'll miss */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text style={textPresets.subtitle}>{t('swap.step1')}</Text>
              {step === 2 && (
                <TouchableOpacity onPress={() => { setOriginalId(null); setTargetId(null); }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.primary }}>{t('swap.change')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {step === 2 && originalSession ? (
              <SessionRow
                title={originalSession.course_name ?? '—'}
                when={`${formatDate(new Date(originalSession.scheduled_at), { weekday: 'long', day: 'numeric', month: 'short' })} · ${formatTime(originalSession.scheduled_at)}`}
                location={originalSession.location}
                selected
              />
            ) : upcomingLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : upcomingError ? (
              <ErrorState onRetry={() => refetchUpcoming()} />
            ) : !upcoming || upcoming.length === 0 ? (
              <EmptyState icon="calendar" title={t('swap.no_upcoming')} />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {upcoming.map((s) => (
                  <TouchableOpacity key={s.id} activeOpacity={0.7} onPress={() => { setOriginalId(s.id); setTargetId(null); }}>
                    <SessionRow
                      title={s.course_name ?? '—'}
                      when={`${formatDate(new Date(s.scheduled_at), { weekday: 'long', day: 'numeric', month: 'short' })} · ${formatTime(s.scheduled_at)}`}
                      location={s.location}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* STEP 2 — pick an alternate session */}
          {step === 2 && (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
              <Text style={[textPresets.subtitle, { marginBottom: spacing.md }]}>{t('swap.step2')}</Text>

              {candidatesLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : !candidates || candidates.length === 0 ? (
                <EmptyState icon="calendar" title={t('swap.no_candidates')} />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {candidates.map((c) => (
                    <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={() => setTargetId(c.id)}>
                      <SessionRow
                        title={c.course_name ?? '—'}
                        teacher={c.teacher_name}
                        when={`${formatDate(new Date(c.scheduled_at), { weekday: 'long', day: 'numeric', month: 'short' })} · ${formatTime(c.scheduled_at)}`}
                        location={c.location}
                        badge={c.remaining_capacity === null ? t('swap.unlimited') : t('swap.remaining', { count: c.remaining_capacity })}
                        selected={targetId === c.id}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {requestMutation.isError && (
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.danger, marginTop: spacing.md, textAlign: 'center' }}>
                  {t('swap.error')}
                </Text>
              )}

              <TouchableOpacity
                onPress={submit}
                disabled={!targetId || requestMutation.isPending}
                activeOpacity={0.85}
                style={{ marginTop: spacing.lg, borderRadius: radius.md, overflow: 'hidden', opacity: !targetId || requestMutation.isPending ? 0.5 : 1 }}
              >
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  {requestMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('swap.request')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SessionRow({ title, when, teacher, location, badge, selected }: {
  title: string;
  when: string;
  teacher?: string | null;
  location?: string | null;
  badge?: string;
  selected?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryLight : colors.background,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
        {!!teacher && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Icon name="teacher" size={14} color={colors.textSecondary} outline style={{ marginEnd: 4 }} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{teacher}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          <Icon name="clock" size={14} color={colors.textSecondary} outline style={{ marginEnd: 4 }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{when}</Text>
        </View>
        {!!location && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Icon name="location" size={14} color={colors.textSecondary} outline style={{ marginEnd: 4 }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{location}</Text>
          </View>
        )}
      </View>
      {!!badge && (
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{badge}</Text>
      )}
      {selected && <Icon name="success" size={22} color={colors.primary} style={{ marginStart: spacing.sm }} />}
    </View>
  );
}
