import { memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen, HeaderCount, Banner } from '@/components/ui/Form';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatNumber, timeAgo } from '@/utils/format';
import { getAssistantActions, rejectAssistantAction, type AssistantAction } from '@/api/assistantActions';

const KIND = (): Record<AssistantAction['kind'], { label: string; icon: IconName; tint: string }> => ({
  proof: { label: 'إثبات دفع', icon: 'card', tint: colors.success },
  bill: { label: 'فاتورة', icon: 'money', tint: colors.success },
  booklet: { label: 'ملزمة', icon: 'book', tint: colors.success },
  booking: { label: 'دفعة حجز', icon: 'money', tint: colors.success },
  attendance: { label: 'تعديل حضور', icon: 'attendance', tint: colors.accent },
});

/** One assistant action: what, how much, who, when — and the one button, «رفض». */
const ActionRow = memo(function ActionRow({ a, busy, onReject }: { a: AssistantAction; busy: boolean; onReject: (a: AssistantAction) => void }) {
  const { t } = useTranslation();
  const k = KIND()[a.kind] ?? KIND().bill;
  const money = a.kind !== 'attendance';
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: k.tint, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: k.tint + '1A', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name={k.icon} size={22} color={k.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={2}>{a.label ?? k.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <View style={{ backgroundColor: k.tint + '1A', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: k.tint }}>{k.label}</Text>
            </View>
            {money ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>{`${formatNumber(Math.round(a.amount))} ${t('insights.egp')}`}</Text> : null}
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{a.assistant_name}</Text>
            {a.created_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{`· ${timeAgo(a.created_at)}`}</Text> : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => onReject(a)} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('assistant_actions.reject')}
          style={{ height: 44, paddingHorizontal: spacing.md, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.danger + '14', borderWidth: 1, borderColor: colors.danger + '55' }}>
          {busy ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="close" size={18} color={colors.danger} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('assistant_actions.reject_short')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

/**
 * «مراجعة إجراءات المساعد» — the teacher's reject-only bucket: an assistant's payment-proof
 * approvals, collections and attendance changes, each undoable within 30 days.
 */
export default function AssistantActionsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['assistant-actions'], queryFn: getAssistantActions });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

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

  const rows = data ?? [];

  return (
    <FormScreen title={t('assistant_actions.title')} subtitle={t('assistant_actions.manage_sub')} scroll={false} right={rows.length > 0 ? <HeaderCount n={rows.length} /> : null}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          data={rows}
          keyExtractor={(a) => String(a.id)}
          renderItem={({ item }) => <ActionRow a={item} busy={reject.isPending && reject.variables === item.id} onReject={confirmReject} />}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={rows.length > 0 ? <Banner tone="warn" icon="eye" text={t('assistant_actions.intro')} /> : null}
          ListEmptyComponent={<EmptyState icon="success" title={t('assistant_actions.none')} message={t('assistant_actions.none_hint')} />}
        />
      )}
    </FormScreen>
  );
}
