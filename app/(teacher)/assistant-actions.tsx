import { memo, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SectionList, ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen, HeaderCount } from '@/components/ui/Form';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatNumber, formatDayDate, formatTime } from '@/utils/format';
import { getAssistantActions, rejectAssistantAction, type AssistantAction } from '@/api/assistantActions';

type Kind = AssistantAction['kind'];
const KIND_ORDER: Kind[] = ['proof', 'bill', 'booklet', 'booking', 'attendance'];
const KIND = (): Record<Kind, { label: string; icon: IconName; tint: string }> => ({
  proof: { label: 'إثبات دفع', icon: 'card', tint: colors.success },
  bill: { label: 'فاتورة', icon: 'money', tint: colors.success },
  booklet: { label: 'ملزمة', icon: 'book', tint: colors.info },
  booking: { label: 'دفعة حجز', icon: 'money', tint: colors.brand },
  attendance: { label: 'تعديل حضور', icon: 'attendance', tint: colors.accent },
});

/** A steady colour per assistant, from the name — the same one on every chip and row. */
const PALETTE = () => [colors.brand, colors.accent, colors.info, colors.success, colors.warningDark, colors.danger];
function hue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const p = PALETTE();
  return p[Math.abs(h) % p.length];
}

function Chip({ label, count, on, tint, onPress, initial }: { label: string; count?: number; on: boolean; tint?: string; onPress: () => void; initial?: string }) {
  const c = tint ?? colors.brand;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingStart: initial ? 4 : 12, paddingEnd: 10, borderRadius: 18, backgroundColor: on ? c : colors.surface, borderWidth: 1, borderColor: on ? c : colors.border }}>
      {initial ? (
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: on ? 'rgba(255,255,255,0.25)' : c + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : c }}>{initial}</Text>
        </View>
      ) : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.textPrimary }} numberOfLines={1}>{label}</Text>
      {count !== undefined ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: on ? 'rgba(255,255,255,0.25)' : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on ? '#fff' : colors.textSecondary }}>{formatNumber(count)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** One assistant action: what, how much, who, when — and the one button, «رفض». */
const ActionRow = memo(function ActionRow({ a, busy, onReject }: { a: AssistantAction; busy: boolean; onReject: (a: AssistantAction) => void }) {
  const { t } = useTranslation();
  const k = KIND()[a.kind] ?? KIND().bill;
  const money = a.kind !== 'attendance';
  const who = hue(a.assistant_name);
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: k.tint + '1A', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name={k.icon} size={22} color={k.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={2}>{a.label ?? k.label}</Text>
            {money ? <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: k.tint }}>{`${formatNumber(Math.round(a.amount))} ${t('insights.egp')}`}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
            <View style={{ backgroundColor: k.tint + '1A', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: k.tint }}>{k.label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: who }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{a.assistant_name}</Text>
            </View>
            {a.created_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{formatTime(a.created_at)}</Text> : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => onReject(a)} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('assistant_actions.reject')}
          style={{ height: 40, paddingHorizontal: spacing.md, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.danger + '14', borderWidth: 1, borderColor: colors.danger + '55' }}>
          {busy ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="close" size={16} color={colors.danger} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('assistant_actions.reject_short')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

/**
 * «مراجعة إجراءات المساعد» — the teacher's reject-only bucket: an assistant's payment-proof
 * approvals, collections and attendance changes, each undoable within 30 days.
 *
 * Founder 2026-10-10: filter by the assistant and by the kind of action, not only money.
 * Two chip rows (each assistant with a count; each kind present with a count), a strip with
 * what the filter adds up to, and the rows grouped by day.
 */
export default function AssistantActionsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['assistant-actions'], queryFn: getAssistantActions });
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const [assistant, setAssistant] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);

  const reject = useMutation({
    mutationFn: (id: number) => rejectAssistantAction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assistant-actions'] });
      qc.invalidateQueries({ queryKey: ['teacher-insights'] });
      qc.invalidateQueries({ queryKey: ['payment-proofs'] });
      // An undone attendance change shows on the student and on the session sheet.
      qc.invalidateQueries({ queryKey: ['teacher-student'] });
      qc.invalidateQueries({ queryKey: ['teacher-session-detail'] });
      qc.invalidateQueries({ queryKey: ['teacher-session-history'] });
    },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const confirmReject = (a: AssistantAction) => {
    Alert.alert(
      t('assistant_actions.reject_confirm_title'),
      a.kind === 'attendance' ? t('assistant_actions.reject_attendance_hint') : t('assistant_actions.reject_confirm_hint', { what: KIND()[a.kind]?.label ?? a.kind, amount: Math.round(a.amount) }),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: t('assistant_actions.reject'), style: 'destructive', onPress: () => reject.mutate(a.id) }],
    );
  };

  const rows = useMemo(() => data ?? [], [data]);
  // The chips come from what is actually there — an assistant or a kind with nothing waiting is no chip.
  const assistants = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.assistant_name, (m.get(r.assistant_name) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const kinds = useMemo(() => {
    const m = new Map<Kind, number>();
    for (const r of rows.filter((r) => !assistant || r.assistant_name === assistant)) m.set(r.kind, (m.get(r.kind) ?? 0) + 1);
    return KIND_ORDER.filter((k) => m.has(k)).map((k) => [k, m.get(k)!] as const);
  }, [rows, assistant]);
  const shown = useMemo(
    () => rows.filter((r) => (!assistant || r.assistant_name === assistant) && (!kind || r.kind === kind)),
    [rows, assistant, kind],
  );
  const money = useMemo(() => shown.filter((r) => r.kind !== 'attendance').reduce((n, r) => n + r.amount, 0), [shown]);
  const sections = useMemo(() => {
    const m = new Map<string, AssistantAction[]>();
    for (const r of shown) {
      const key = r.created_at ? formatDayDate(r.created_at) : '—';
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return [...m.entries()].map(([title, items]) => ({ title, data: items }));
  }, [shown]);
  const filtered = !!assistant || !!kind;

  return (
    <FormScreen title={t('assistant_actions.title')} subtitle={t('assistant_actions.manage_sub')} scroll={false} right={rows.length > 0 ? <HeaderCount n={rows.length} /> : null}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : rows.length === 0 ? (
        <EmptyState icon="success" title={t('assistant_actions.none')} message={t('assistant_actions.none_hint')} />
      ) : (
        <SectionList showsVerticalScrollIndicator={false}
          sections={sections}
          keyExtractor={(a) => String(a.id)}
          stickySectionHeadersEnabled={false}
          renderItem={({ item }) => <ActionRow a={item} busy={reject.isPending && reject.variables === item.id} onReject={confirmReject} />}
          renderSectionHeader={({ section }) => (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.sm }}>{section.title}</Text>
          )}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={{ paddingTop: spacing.md }}>
              {/* Who: one chip per assistant, with how many of theirs wait. */}
              {assistants.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
                  <Chip label={t('assistant_actions.all')} count={rows.length} on={!assistant} onPress={() => setAssistant(null)} />
                  {assistants.map(([name, n]) => (
                    <Chip key={name} label={name} count={n} on={assistant === name} tint={hue(name)} initial={name.trim().charAt(0)} onPress={() => setAssistant(assistant === name ? null : name)} />
                  ))}
                </ScrollView>
              ) : null}
              {/* What: one chip per kind present. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
                <Chip label={t('assistant_actions.all_kinds')} on={!kind} onPress={() => setKind(null)} />
                {kinds.map(([k, n]) => (
                  <Chip key={k} label={KIND()[k].label} count={n} on={kind === k} tint={KIND()[k].tint} onPress={() => setKind(kind === k ? null : k)} />
                ))}
              </ScrollView>
              {/* What the filter adds up to. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs }}>
                <Icon name="eye" size={16} color={colors.textSecondary} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>
                  {t('assistant_actions.count_actions', { count: shown.length })}
                  {money > 0 ? `  ·  ${t('assistant_actions.total_money', { amount: formatNumber(Math.round(money)) })}` : ''}
                </Text>
                {filtered ? (
                  <TouchableOpacity onPress={() => { setAssistant(null); setKind(null); }} hitSlop={8} accessibilityRole="button">
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('assistant_actions.clear_filter')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {!filtered ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginBottom: spacing.xs }}>{t('assistant_actions.intro_short')}</Text> : null}
            </View>
          }
          ListEmptyComponent={<EmptyState icon="search" title={t('assistant_actions.none_filter')} />}
        />
      )}
    </FormScreen>
  );
}
