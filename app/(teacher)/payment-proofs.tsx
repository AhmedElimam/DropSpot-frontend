import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Modal, TextInput, KeyboardAvoidingView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getPaymentProofs, approvePaymentProof, rejectPaymentProof, type PaymentProof } from '@/api/paymentProofs';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function PaymentProofsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['payment-proofs'], queryFn: getPaymentProofs });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [preview, setPreview] = useState<string | null>(null); // image url in the lightbox
  const [rejecting, setRejecting] = useState<PaymentProof | null>(null);
  const [reason, setReason] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payment-proofs'] });
    qc.invalidateQueries({ queryKey: ['teacher-insights'] });
  };

  const approve = useMutation({
    mutationFn: (id: number) => approvePaymentProof(id),
    onSuccess: () => { invalidate(); Alert.alert(t('payment_proofs.approved')); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: ({ id, r }: { id: number; r: string }) => rejectPaymentProof(id, r),
    onSuccess: () => { invalidate(); setRejecting(null); setReason(''); Alert.alert(t('payment_proofs.rejected')); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const confirmApprove = (p: PaymentProof) => {
    Alert.alert(
      t('payment_proofs.approve_confirm_title'),
      t('payment_proofs.approve_confirm_hint', { number: p.invoice?.number ?? '', amount: p.invoice?.amount ?? 0 }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('payment_proofs.approve'), onPress: () => approve.mutate(p.id) },
      ],
    );
  };

  const money = (v: number) => `${Math.round(v).toLocaleString('en-US')} ${t('insights.egp')}`;

  const ProofCard = ({ p, review }: { p: PaymentProof; review: boolean }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <TouchableOpacity onPress={() => setPreview(p.image_url)} activeOpacity={0.85}>
          <Image source={{ uri: p.image_url }} style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }} resizeMode="cover" />
          <View style={{ position: 'absolute', bottom: 2, insetInlineEnd: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: 2 }}>
            <Icon name="eye" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>
            {p.invoice?.student_name ?? t('payment_proofs.unknown_student')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {t('payment_proofs.invoice')} #{p.invoice?.number ?? '—'} · {p.invoice ? money(p.invoice.amount) : ''}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
            {p.submitted_by_name ? `${p.submitted_by_name} · ` : ''}{fmtDate(p.submitted_at)}
          </Text>
        </View>
        {review ? <StatusBadge status={p.status} size="sm" /> : null}
      </View>

      {review && p.status === 'rejected' && p.rejection_reason ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText, marginTop: spacing.sm }}>
          {t('payment_proofs.reason')}: {p.rejection_reason}
        </Text>
      ) : null}

      {!review ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity
            onPress={() => confirmApprove(p)}
            disabled={approve.isPending}
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, backgroundColor: colors.success }}
          >
            <Icon name="success" size={18} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('payment_proofs.approve')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setRejecting(p); setReason(''); }}
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger }}
          >
            <Icon name="close" size={18} color={colors.danger} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{t('payment_proofs.reject')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const pending = data?.pending ?? [];
  const reviewed = data?.reviewed ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('payment_proofs.title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.sm }}>
            {t('payment_proofs.pending')} ({pending.length})
          </Text>
          {pending.length === 0 ? (
            <EmptyState icon="success" title={t('payment_proofs.none_pending')} message={t('payment_proofs.none_pending_hint')} />
          ) : (
            pending.map((p) => <ProofCard key={p.id} p={p} review={false} />)
          )}

          {reviewed.length > 0 ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.lg, marginBottom: spacing.sm }}>
                {t('payment_proofs.reviewed')}
              </Text>
              {reviewed.map((p) => <ProofCard key={p.id} p={p} review />)}
            </>
          ) : null}
        </ScrollView>
      )}

      {/* Screenshot lightbox */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setPreview(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: spacing.md }}>{t('common.close')}</Text>
        </TouchableOpacity>
      </Modal>

      {/* Reject reason */}
      <Modal visible={!!rejecting} transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setRejecting(null)} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xxl, paddingBottom: spacing.xl5 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xl }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('payment_proofs.reject_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs }}>{t('payment_proofs.reject_hint')}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t('payment_proofs.reason_ph')}
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{ fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg, color: colors.textPrimary, textAlign: 'right', minHeight: 90, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border }}
            />
            <TouchableOpacity
              onPress={() => { if (reason.trim().length >= 3 && rejecting) reject.mutate({ id: rejecting.id, r: reason.trim() }); }}
              disabled={reason.trim().length < 3 || reject.isPending}
              activeOpacity={0.85}
              style={{ height: 52, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', opacity: reason.trim().length < 3 || reject.isPending ? 0.5 : 1 }}
            >
              {reject.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('payment_proofs.reject')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
