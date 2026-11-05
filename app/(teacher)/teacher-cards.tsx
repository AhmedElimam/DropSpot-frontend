import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChips } from '@/components/ui/FilterChips';
import { Alert } from '@/ui/dialog';
import { Surface } from '@/ui/surfaces';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatDate } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  confirmTeacherCardBatch, getTeacherCardBatch, getTeacherCards, revokeTeacherCard, unclaimTeacherCard,
  type TeacherCardBatch, type TeacherCardRow, type TeacherCardState,
} from '@/api/teacherCards';

/** Read at render time, so a theme switch repaints the chips. */
function tone(state: TeacherCardState): { fg: string; bg: string } {
  switch (state) {
    case 'unclaimed': return { fg: colors.info, bg: colors.infoLight };
    case 'active': return { fg: colors.success, bg: colors.successLight };
    case 'revoked_by_master': return { fg: colors.warning, bg: colors.warningLight };
    case 'revoked': return { fg: colors.danger, bg: colors.dangerLight };
    case 'expired': return { fg: colors.textTertiary, bg: colors.surfaceSunken };
    default: return { fg: colors.textSecondary, bg: colors.surfaceSunken };
  }
}
const ORDER: TeacherCardState[] = ['unclaimed', 'active', 'revoked_by_master', 'revoked', 'expired', 'pending_delivery'];

function serverMessage(e: unknown): string {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof m === 'string' && m.trim() ? m : getFriendlyErrorMessage(e);
}

function Chip({ state, label, n }: { state: TeacherCardState; label: string; n?: number }) {
  return (
    <View style={{ backgroundColor: tone(state).bg, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: tone(state).fg }}>{n === undefined ? label : `${label}: ${n}`}</Text>
    </View>
  );
}

/**
 * «كروت المدرّس» — the teacher's batches of blank cards: confirm a batch reached you (the
 * teacher only), see each card's state, put a wrong claim right within 24 hours, revoke a lost
 * card. Claiming itself happens at the door: scan a blank and pick the student.
 */
export default function TeacherCardsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [open, setOpen] = useState<TeacherCardBatch | null>(null);
  // The batch's cards by state (founder 2026-11-05: filters on the cards page).
  const [state, setState] = useState<TeacherCardState | 'all'>('all');

  const overview = useQuery({ queryKey: ['teacher-cards', 'overview'], queryFn: getTeacherCards });
  const cards = useInfiniteQuery({
    queryKey: ['teacher-cards', 'batch', open?.id, state],
    queryFn: ({ pageParam }) => getTeacherCardBatch(open!.id, pageParam, state === 'all' ? undefined : state),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.last_page ? last.page + 1 : undefined),
    enabled: !!open,
  });
  const { refreshing, onRefresh } = usePullRefresh(async () => { await overview.refetch(); if (open) await cards.refetch(); });

  const done = (message: string) => {
    qc.invalidateQueries({ queryKey: ['teacher-cards'] });
    if (message) Alert.alert(message);
  };
  const fail = (e: unknown) => Alert.alert(t('common.error'), serverMessage(e));

  const confirm = useMutation({ mutationFn: (b: TeacherCardBatch) => confirmTeacherCardBatch(b.id), onSuccess: done, onError: fail });
  const unclaim = useMutation({ mutationFn: (c: TeacherCardRow) => unclaimTeacherCard(c.id), onSuccess: done, onError: fail });
  const revoke = useMutation({ mutationFn: ({ c, reason }: { c: TeacherCardRow; reason: string }) => revokeTeacherCard(c.id, reason), onSuccess: done, onError: fail });

  const data = overview.data;
  const labels = data?.labels;

  const askConfirm = (b: TeacherCardBatch) => Alert.alert(t('teacher_cards.confirm_receipt_title'), t('teacher_cards.confirm_receipt_body', { n: b.quantity }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('teacher_cards.confirm_receipt'), onPress: () => confirm.mutate(b) },
  ]);
  const askUnclaim = (c: TeacherCardRow) => Alert.alert(t('teacher_cards.unclaim_title'), t('teacher_cards.unclaim_body', { name: c.student?.name ?? '' }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('teacher_cards.unclaim'), onPress: () => unclaim.mutate(c) },
  ]);
  const askRevoke = (c: TeacherCardRow) => Alert.alert(t('teacher_cards.revoke_title', { seq: c.seq }), t('teacher_cards.revoke_body'), [
    ...Object.entries(data?.revoke_reasons ?? {}).map(([reason, label]) => ({ text: label, style: 'destructive' as const, onPress: () => revoke.mutate({ c, reason }) })),
    { text: t('common.cancel'), style: 'cancel' as const },
  ]);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
      <TouchableOpacity onPress={() => (open ? (setOpen(null), setState('all')) : router.back())} accessibilityRole="button" accessibilityLabel={t('common.back')}
        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="forward" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>
        {open ? t('teacher_cards.batch_title', { n: open.quantity }) : t('teacher_cards.title')}
      </Text>
    </View>
  );

  const batchRow = ({ item: b }: { item: TeacherCardBatch }) => (
    <TouchableOpacity onPress={() => setOpen(b)} activeOpacity={0.85} accessibilityRole="button"
      style={{ padding: spacing.lg, marginBottom: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: b.status === 'pending_delivery' ? colors.warning : colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="card" size={20} color={colors.brand} />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('teacher_cards.batch_title', { n: b.quantity })}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>
          {b.expires_at ? t('teacher_cards.valid_until', { date: formatDate(new Date(b.expires_at)) }) : t('teacher_cards.no_expiry')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
        {labels ? ORDER.filter((s) => (b.counts[s] ?? 0) > 0).map((s) => <Chip key={s} state={s} label={labels[s]} n={b.counts[s]} />) : null}
      </View>
      {b.status === 'pending_delivery' ? (
        data?.can_confirm ? (
          <TouchableOpacity onPress={() => askConfirm(b)} disabled={confirm.isPending} activeOpacity={0.85} accessibilityRole="button"
            style={{ marginTop: spacing.md, height: 44, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Icon name="success" size={18} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('teacher_cards.confirm_receipt')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.warning, marginTop: spacing.sm }}>{t('teacher_cards.awaiting_teacher')}</Text>
        )
      ) : null}
    </TouchableOpacity>
  );

  const cardRow = ({ item: c }: { item: TeacherCardRow }) => (
    <View style={{ padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textTertiary, minWidth: 36 }}>#{c.seq}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{c.student?.name ?? '—'}</Text>
          {c.revoke_reason || c.grace_used_at ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {[c.revoke_reason, c.grace_used_at ? t('teacher_cards.grace_used') : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <Chip state={c.status} label={c.status_label} />
      </View>
      {c.can_unclaim || c.can_revoke ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          {c.can_unclaim ? (
            <TouchableOpacity onPress={() => askUnclaim(c)} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, height: 38, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t('teacher_cards.unclaim')}</Text>
            </TouchableOpacity>
          ) : null}
          {c.can_revoke ? (
            <TouchableOpacity onPress={() => askRevoke(c)} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, height: 38, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('teacher_cards.revoke')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const intro = (
    <View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md }}>{t('teacher_cards.intro')}</Text>
      {data?.low_stock ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight }}>
          <Icon name="warning" size={18} color={colors.warning} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t('teacher_cards.low_stock', { n: data.totals.unclaimed })}</Text>
        </View>
      ) : null}
    </View>
  );

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />;
  const pad = { flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl };

  return (
    <Surface id="screen.teacher.teacher-cards" screen>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {header}
      {overview.isLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} /> : open ? (
        <FlatList
          data={(cards.data?.pages ?? []).flatMap((p) => p.cards)}
          keyExtractor={(c) => String(c.id)}
          renderItem={cardRow}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={9}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (cards.hasNextPage && !cards.isFetchingNextPage) void cards.fetchNextPage(); }}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={pad}
          ListHeaderComponent={labels ? (
            <View style={{ marginBottom: spacing.sm }}>
              <FilterChips
                options={[{ key: 'all' as const, label: t('teacher_cards.filter_all') }, ...ORDER.filter((s) => s !== 'pending_delivery' && (open.counts[s] ?? 0) > 0).map((s) => ({ key: s, label: `${labels[s]} ${open.counts[s]}` }))]}
                value={state}
                onChange={(k) => setState(k)}
              />
            </View>
          ) : null}
          ListEmptyComponent={cards.isLoading ? <ActivityIndicator color={colors.primary} /> : <EmptyState icon="card" title={t('teacher_cards.none_in_filter')} />}
          ListFooterComponent={cards.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
        />
      ) : (
        <FlatList
          data={data?.batches ?? []}
          keyExtractor={(b) => String(b.id)}
          renderItem={batchRow}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          refreshControl={refresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={pad}
          ListHeaderComponent={intro}
          ListEmptyComponent={<EmptyState icon="card" title={t('teacher_cards.none')} message={t('teacher_cards.none_hint')} />}
        />
      )}
    </View>
    </Surface>
  );
}
