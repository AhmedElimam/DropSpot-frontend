import { SheetModal } from '@/components/ui/SheetModal';
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { AppModal as Modal } from '@/ui/AppModal';
import { Alert } from '@/ui/dialog';
import { FlatList } from '@/components/ui/Refreshable';
import { PageHero } from '@/components/ui/PageHero';
// expo-image decodes to the rendered size. The old Image decoded every proof screenshot at
// full resolution (a 12 MP shot is ~48 MB as a bitmap) for a 64 px thumbnail — twenty proofs
// in the list was the memory pressure Play Console reported.
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { formatNumber } from '@/utils/format';
import { formatDateTime } from '@/utils/format';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getPaymentProofs, approvePaymentProof, rejectPaymentProof, type PaymentProof } from '@/api/paymentProofs';
import { Surface } from '@/ui/surfaces';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatDateTime(d, { weekday: 'short' });
}

export default function PaymentProofsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['payment-proofs'], queryFn: getPaymentProofs });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [preview, setPreview] = useState<number | null>(null); // the proof in the lightbox
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

  const money = (v: number) => `${formatNumber(Math.round(v))} ${t('insights.egp')}`;

  const pending = data?.pending ?? [];
  const reviewed = data?.reviewed ?? [];
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const list = tab === 'pending' ? pending : reviewed;
  const pendingTotal = pending.reduce((a, p) => a + (p.invoice?.amount ?? 0), 0);
  const approvedCount = reviewed.filter((p) => p.status === 'approved').length;
  const shown = preview ? [...pending, ...reviewed].find((p) => p.id === preview) ?? null : null;

  const renderItem = ({ item: p }: { item: PaymentProof }) => tab === 'pending' ? (
    // Waiting: the screenshot first and large — that is what the teacher checks — then who and how much.
    <Surface id="teacher.payment_proofs.pending_card" ctx={{ proof: p }}>
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', ...shadows.sm }}>
      <TouchableOpacity onPress={() => setPreview(p.id)} activeOpacity={0.9} accessibilityRole="imagebutton" accessibilityLabel={t('payment_proofs.tap_to_zoom')}>
        <Image source={{ uri: p.image_url, cacheKey: `proof-${p.id}` }} style={{ width: '100%', height: 170, backgroundColor: colors.surfaceSunken }} contentFit="cover" recyclingKey={String(p.id)} />
        <View style={{ position: 'absolute', bottom: spacing.sm, end: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Icon name="eye" size={13} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#fff' }}>{t('payment_proofs.tap_to_zoom')}</Text>
        </View>
      </TouchableOpacity>
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{p.invoice?.student_name ?? t('payment_proofs.unknown_student')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>{t('payment_proofs.invoice')} #{p.invoice?.number ?? '—'}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>{p.submitted_by_name ? `${p.submitted_by_name} · ` : ''}{fmtDate(p.submitted_at)}</Text>
          </View>
          {p.invoice ? <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.brand }}>{money(p.invoice.amount)}</Text> : null}
        </View>
        <Actions p={p} />
      </View>
    </View>
    </Surface>
  ) : (
    // Reviewed: compact — what was decided, by whom, and why when refused.
    <Surface id="teacher.payment_proofs.reviewed_card" ctx={{ proof: p }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
      <TouchableOpacity onPress={() => setPreview(p.id)} activeOpacity={0.85} accessibilityLabel={t('payment_proofs.tap_to_zoom')}>
        <Image source={{ uri: p.image_url, cacheKey: `proof-${p.id}` }} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }} contentFit="cover" recyclingKey={String(p.id)} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{p.invoice?.student_name ?? t('payment_proofs.unknown_student')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
          {[p.invoice ? money(p.invoice.amount) : null, p.reviewer_name, fmtDate(p.reviewed_at ?? p.submitted_at)].filter(Boolean).join(' · ')}
        </Text>
        {p.status === 'rejected' && p.rejection_reason ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText, marginTop: 2 }} numberOfLines={2}>{t('payment_proofs.reason')}: {p.rejection_reason}</Text>
        ) : null}
      </View>
      <StatusBadge status={p.status} size="sm" />
    </View>
    </Surface>
  );

  const Actions = ({ p, onDark = false }: { p: PaymentProof; onDark?: boolean }) => (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
      <Surface id="teacher.payment_proofs.approve_button">
      <TouchableOpacity onPress={() => confirmApprove(p)} disabled={approve.isPending} activeOpacity={0.85} accessibilityRole="button"
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: radius.lg, backgroundColor: colors.success }}>
        {approve.isPending ? <ActivityIndicator color="#fff" /> : <Icon name="success" size={18} color="#fff" />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#fff' }}>{t('payment_proofs.approve')}</Text>
      </TouchableOpacity>
      </Surface>
      <Surface id="teacher.payment_proofs.reject_button">
      <TouchableOpacity onPress={() => { setPreview(null); setRejecting(p); setReason(''); }} activeOpacity={0.85} accessibilityRole="button"
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: onDark ? '#FF8A80' : colors.danger }}>
        <Icon name="close" size={18} color={onDark ? '#FF8A80' : colors.danger} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: onDark ? '#FF8A80' : colors.danger }}>{t('payment_proofs.reject')}</Text>
      </TouchableOpacity>
      </Surface>
    </View>
  );

  return (
    <Surface id="screen.teacher.payment-proofs" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={isLoading ? [] : list}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
        ListHeaderComponent={
          <View>
            <Surface id="teacher.payment_proofs.header">
            <PageHero
              title={t('payment_proofs.title')}
              subtitle={t('payment_proofs.hero_sub')}
              onBack
              stats={[
                { value: formatNumber(pending.length), label: t('payment_proofs.pending'), warn: pending.length > 0 },
                { value: money(pendingTotal), label: t('payment_proofs.pending_total') },
                { value: formatNumber(approvedCount), label: t('payment_proofs.approved_count') },
              ]}
            />
            </Surface>
            <Surface id="teacher.payment_proofs.tabs">
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.lg, marginTop: -spacing.xl4 + spacing.md, marginBottom: spacing.md, ...shadows.sm }}>
              {([['pending', t('payment_proofs.pending'), pending.length], ['reviewed', t('payment_proofs.reviewed'), reviewed.length]] as const).map(([k, label, n]) => {
                const on = tab === k;
                return (
                  <TouchableOpacity key={k} onPress={() => setTab(k)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={{ flex: 1, minHeight: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brand : 'transparent' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.onPrimary : colors.textSecondary }}>{`${label} · ${formatNumber(n)}`}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            </Surface>
          </View>
        }
        ListEmptyComponent={isLoading
          ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
          : tab === 'pending'
            ? <EmptyState icon="success" title={t('payment_proofs.none_pending')} message={t('payment_proofs.none_pending_hint')} />
            : <EmptyState icon="invoices" title={t('payment_proofs.none_reviewed')} />}
      />

      {/* The screenshot large, with who and how much — and, while it waits, the decision. */}
      <Surface id="teacher.payment_proofs.lightbox">
      <Modal visible={!!shown} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md, paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setPreview(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {shown ? <Image source={{ uri: shown.image_url, cacheKey: `proof-${shown.id}` }} style={{ flex: 1, marginVertical: spacing.md }} contentFit="contain" /> : null}
          {shown ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }} numberOfLines={1}>{shown.invoice?.student_name ?? t('payment_proofs.unknown_student')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>{t('payment_proofs.invoice')} #{shown.invoice?.number ?? '—'}</Text>
                </View>
                {shown.invoice ? <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff' }}>{money(shown.invoice.amount)}</Text> : null}
              </View>
              {shown.status === 'pending' ? <Actions p={shown} onDark /> : null}
            </View>
          ) : null}
        </View>
      </Modal>
      </Surface>

      {/* Reject reason */}
      <Surface id="teacher.payment_proofs.reject_sheet">
      <SheetModal visible={!!rejecting} onClose={() => setRejecting(null)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xxl, paddingBottom: spacing.xl5 }}>
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
      </SheetModal>
      </Surface>
    </View>
    </Surface>
  );
}
