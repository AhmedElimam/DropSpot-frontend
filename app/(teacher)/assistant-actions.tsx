import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getAssistantActions, rejectAssistantAction, type AssistantAction } from '@/api/assistantActions';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

const KIND_LABEL: Record<AssistantAction['kind'], string> = {
  proof: 'إثبات دفع', bill: 'فاتورة', booklet: 'ملزمة', booking: 'دفعة حجز',
};

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
    },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const confirmReject = (a: AssistantAction) => {
    Alert.alert(
      t('assistant_actions.reject_confirm_title'),
      t('assistant_actions.reject_confirm_hint', { what: KIND_LABEL[a.kind], amount: Math.round(a.amount) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('assistant_actions.reject'), style: 'destructive', onPress: () => reject.mutate(a.id) },
      ],
    );
  };

  const rows = data ?? [];

  const Card = ({ a }: { a: AssistantAction }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.warning, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3E2', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="money" size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={2}>{a.label ?? KIND_LABEL[a.kind]}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {KIND_LABEL[a.kind]} · {Math.round(a.amount).toLocaleString('en-US')} {t('insights.egp')} · {a.assistant_name}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{fmtDate(a.created_at)}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => confirmReject(a)} disabled={reject.isPending} activeOpacity={0.85}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, marginTop: spacing.md }}>
        <Icon name="close" size={18} color={colors.danger} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{t('assistant_actions.reject')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('assistant_actions.title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('assistant_actions.intro')}</Text>
          {rows.length === 0 ? (
            <EmptyState icon="success" title={t('assistant_actions.none')} message={t('assistant_actions.none_hint')} />
          ) : (
            rows.map((a) => <Card key={a.id} a={a} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}
