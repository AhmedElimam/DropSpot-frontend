import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { FlatList } from '@/components/ui/Refreshable';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { Surface } from '@/ui/surfaces';
import { foldForSearch, formatNumber, formatShortDate } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { askRemovalSms } from '@/components/teacher/askRemovalSms';
import {
  getTerminationCandidates, terminateEnrollment, getEndedEnrollments, reactivateEnrollment,
  type TerminationCandidate, type EndedEnrollment,
} from '@/api/resolution';

type Tab = 'absent' | 'ended';
type Row = { kind: 'absent'; c: TerminationCandidate } | { kind: 'ended'; e: EndedEnrollment };

/**
 * «الغياب وانتهاء التسجيل» — its own page (founder 2026-10-30: not buried in the resolution
 * center), with the same filters as «أرقام تحتاج تأكيد»:
 *   - غياب متكرر  — students on a run of absences: look, then end the enrolment (and choose
 *                   whether to text the family);
 *   - انتهى تسجيلهم — enrolments ended in the last 30 days: undo one, and see which accounts
 *                   nobody in the family ever claimed, with the days left before deletion.
 */
export default function EnrollmentEndsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('absent');
  const [groupId, setGroupId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const absent = useQuery({ queryKey: ['resolution-termination'], queryFn: getTerminationCandidates });
  const ended = useQuery({ queryKey: ['ended-enrollments'], queryFn: getEndedEnrollments });
  const { refreshing, onRefresh } = usePullRefresh(absent.refetch, ended.refetch);

  const rows: Row[] = useMemo(
    () => (tab === 'absent'
      ? (absent.data ?? []).map((c) => ({ kind: 'absent' as const, c }))
      : (ended.data ?? []).map((e) => ({ kind: 'ended' as const, e }))),
    [tab, absent.data, ended.data],
  );

  const groupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const x = r.kind === 'absent' ? r.c : r.e;
      if (x.schedule_id != null) seen.set(String(x.schedule_id), x.group_label ?? x.course_name ?? '');
    }
    return [{ key: '', label: t('ends.all_groups') }, ...Array.from(seen, ([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'ar'))];
  }, [rows, t]);

  const shown = useMemo(() => {
    const q = foldForSearch(query);
    return rows.filter((r) => {
      const x = r.kind === 'absent' ? r.c : r.e;
      if (groupId && String(x.schedule_id ?? '') !== groupId) return false;
      return !q || [x.student_name, x.student_code, x.course_name].some((v) => foldForSearch(v).includes(q));
    });
  }, [rows, groupId, query]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['resolution-termination'] });
    qc.invalidateQueries({ queryKey: ['ended-enrollments'] });
    qc.invalidateQueries({ queryKey: ['resolution-summary'] });
  };

  const terminate = (c: TerminationCandidate) => {
    Alert.alert(
      t('resolution.terminate_title'),
      t('resolution.terminate_confirm', { name: c.student_name ?? '', course: c.course_name ?? '', n: c.absences }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('resolution.terminate_action'), style: 'destructive',
          onPress: async () => {
            setBusy(c.enrollment_id);
            try {
              const sms = await terminateEnrollment(c.enrollment_id);
              refresh();
              askRemovalSms(t, c.enrollment_id, sms);
            } catch (e) {
              Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const reactivate = (e: EndedEnrollment) => {
    Alert.alert(t('ends.reactivate_title'), t('ends.reactivate_body', { name: e.student_name ?? '', group: e.group_label ?? e.course_name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ends.reactivate'),
        onPress: async () => {
          setBusy(e.enrollment_id);
          try {
            await reactivateEnrollment(e.enrollment_id);
            refresh();
            Alert.alert('', t('ends.reactivated'));
          } catch (err) {
            Alert.alert(t('common.error'), getFriendlyErrorMessage(err));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const loading = tab === 'absent' ? absent.isLoading : ended.isLoading;
  const counts = { absent: absent.data?.length ?? 0, ended: ended.data?.length ?? 0 };

  return (
    <Surface id="screen.teacher.enrollment-ends" screen>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('ends.title')}</Text>
      </View>

      {/* The two lists, each with its count. */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        {(['absent', 'ended'] as const).map((k) => {
          const on = tab === k;
          return (
            <TouchableOpacity key={k} onPress={() => { setTab(k); setGroupId(''); }} accessibilityRole="tab" accessibilityState={{ selected: on }} activeOpacity={0.85}
              style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: radius.lg, borderWidth: 1,
                borderColor: on ? (k === 'absent' ? colors.danger : colors.brand) : colors.border, backgroundColor: on ? (k === 'absent' ? colors.danger : colors.brand) : colors.surface }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.white : colors.textSecondary }}>{t(`ends.tab_${k}`)}</Text>
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.surfaceSunken }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.white : colors.textSecondary }}>{formatNumber(counts[k])}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => `${r.kind}-${r.kind === 'absent' ? r.c.enrollment_id : r.e.enrollment_id}`}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={rows.length === 0 ? null : (
            <View style={{ marginBottom: spacing.md, gap: spacing.sm }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>{t(`ends.intro_${tab}`)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 46 }}>
                <Icon name="search" size={16} color={colors.textTertiary} />
                <TextInput value={query} onChangeText={setQuery} placeholder={t('ends.search_ph')} placeholderTextColor={colors.textTertiary}
                  style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, paddingVertical: 8 }} />
              </View>
              {groupOptions.length > 2 ? <SelectField value={groupId} options={groupOptions} placeholder={t('ends.all_groups')} onChange={setGroupId} /> : null}
              {shown.length !== rows.length ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('ends.shown', { n: formatNumber(shown.length), total: formatNumber(rows.length) })}</Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={rows.length === 0
            ? <EmptyState icon="success" title={t(`ends.empty_${tab}`)} message={t(`ends.empty_${tab}_hint`)} />
            : <EmptyState icon="search" title={t('ends.none_filtered')} message={t('ends.none_filtered_hint')} />}
          renderItem={({ item }) => (item.kind === 'absent'
            ? <AbsentCard c={item.c} busy={busy === item.c.enrollment_id} onTerminate={() => terminate(item.c)} />
            : <EndedCard e={item.e} busy={busy === item.e.enrollment_id} onReactivate={() => reactivate(item.e)} />)}
        />
      )}
    </View>
    </Surface>
  );
}

function Who({ id, name, code, group, tint }: { id: number; name: string | null; code: string | null; group: string | null; tint: string }) {
  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/students/${id}` as Href)} activeOpacity={0.8} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tint + '22', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: tint }}>{(name ?? '؟').trim().charAt(0)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{name ?? '—'}</Text>
        {code ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{code}</Text> : null}
      </View>
      <Icon name="back" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

function GroupChip({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: spacing.sm }}>
      <Icon name="calendar" size={12} color={colors.textSecondary} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}

// A function, not a constant: theme tokens are live (a constant would keep the first theme's colours).
const card = () => ({ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm });

function AbsentCard({ c, busy, onTerminate }: { c: TerminationCandidate; busy: boolean; onTerminate: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ ...card(), borderStartColor: colors.danger }}>
      <Who id={c.student_id} name={c.student_name} code={c.student_code} group={c.group_label ?? null} tint={colors.danger} />
      <GroupChip label={c.group_label ?? c.course_name} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
        <View style={{ minWidth: 34, height: 34, borderRadius: 17, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.dangerText }}>{formatNumber(c.absences)}</Text>
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>
          {t('resolution.absences_n', { n: c.absences })} · {c.last_present_at ? t('resolution.last_present', { date: formatShortDate(c.last_present_at) }) : t('resolution.never_present')}
        </Text>
      </View>
      {c.absent_dates && c.absent_dates.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
          {[...c.absent_dates].reverse().map((d, i) => (
            <View key={`${d}-${i}`} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{formatShortDate(d)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Surface id="teacher.enrollment_ends.terminate_button" assistantNeeds="manage_students">
      <TouchableOpacity disabled={busy} onPress={onTerminate} activeOpacity={0.85}
        style={{ marginTop: spacing.md, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color={colors.dangerText} /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }}>{t('resolution.terminate_action')}</Text>}
      </TouchableOpacity>
      </Surface>
    </View>
  );
}

function EndedCard({ e, busy, onReactivate }: { e: EndedEnrollment; busy: boolean; onReactivate: () => void }) {
  const { t } = useTranslation();
  const atRisk = e.deletes_in_days != null;
  return (
    <View style={{ ...card(), borderStartColor: atRisk ? colors.warning : colors.borderStrong }}>
      <Who id={e.student_id} name={e.student_name} code={e.student_code} group={e.group_label} tint={colors.brand} />
      <GroupChip label={e.group_label ?? e.course_name} />
      {e.ended_at ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{t('ends.ended_on', { date: formatShortDate(e.ended_at) })}</Text>
      ) : null}
      {/* Nobody in the family ever claimed the account: say plainly when it goes. */}
      {atRisk ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm }}>
          <Icon name="clock" size={14} color={colors.warningText} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningText, lineHeight: 19 }}>
            {e.deletes_in_days === 0 ? t('ends.deletes_today') : t('ends.deletes_in', { n: formatNumber(e.deletes_in_days ?? 0) })}
          </Text>
        </View>
      ) : null}
      {e.can_reactivate ? (
        <Surface id="teacher.enrollment_ends.reactivate_button" assistantNeeds="manage_students">
        <TouchableOpacity disabled={busy} onPress={onReactivate} activeOpacity={0.85}
          style={{ marginTop: spacing.md, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.brandTint, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <ActivityIndicator color={colors.brand} /> : <Icon name="add" size={16} color={colors.brand} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('ends.reactivate')}</Text>
        </TouchableOpacity>
        </Surface>
      ) : (
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>{t('ends.already_back')}</Text>
      )}
    </View>
  );
}
