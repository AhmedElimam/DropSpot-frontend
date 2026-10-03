import { SheetModal } from '@/components/ui/SheetModal';
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { formatDateTime } from '@/utils/format';
import { colors, spacing, radius, nav, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { getBookingRequests, acceptBookingRequest, rejectBookingRequest, type BookingRequest } from '@/api/bookingRequests';
import { EnrollmentTermsSheet, useEnrollmentTerms } from '@/components/teacher/EnrollmentTermsSheet';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatDateTime(d);
}

export default function BookingRequestsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['booking-requests'], queryFn: getBookingRequests });
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['booking-requests'] });
    qc.invalidateQueries({ queryKey: ['teacher-students'] });
  };

  // Accepting states the enrolment terms like every other door (position in the month,
  // دفعة, booklet) — a family that paid at the desk is recorded here, not re-billed.
  const [accepting, setAccepting] = useState<BookingRequest | null>(null);
  const terms = useEnrollmentTerms(accepting?.course_id ?? null);
  const accept = useMutation({
    mutationFn: (r: BookingRequest) => acceptBookingRequest(r.id, terms.payload()),
    onSuccess: () => { setAccepting(null); invalidate(); Alert.alert(t('booking_requests.accepted')); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: (id: number) => rejectBookingRequest(id),
    onSuccess: () => { invalidate(); },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const confirmAccept = (r: BookingRequest) => setAccepting(r);
  const confirmReject = (r: BookingRequest) => {
    Alert.alert(t('booking_requests.reject_confirm_title'), t('booking_requests.reject_confirm_hint', { name: r.student_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('booking_requests.reject'), style: 'destructive', onPress: () => reject.mutate(r.id) },
    ]);
  };

  const rows = data ?? [];

  const Card = ({ r }: { r: BookingRequest }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.warning, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.warningLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="child" size={20} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{r.student_name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {r.course_name ?? '—'}{r.student_code ? ` · ${r.student_code}` : ''}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{fmtDate(r.created_at)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity onPress={() => confirmAccept(r)} disabled={accept.isPending || reject.isPending} activeOpacity={0.85}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, backgroundColor: colors.success }}>
          <Icon name="success" size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('booking_requests.accept')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => confirmReject(r)} disabled={accept.isPending || reject.isPending} activeOpacity={0.85}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger }}>
          <Icon name="close" size={18} color={colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{t('booking_requests.reject')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('booking_requests.title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('booking_requests.intro')}</Text>
          {rows.length === 0 ? (
            <EmptyState icon="success" title={t('booking_requests.none')} message={t('booking_requests.none_hint')} />
          ) : (
            rows.map((r) => <Card key={r.id} r={r} />)
          )}
        </ScrollView>
      )}

      {/* Accept sheet: the student, then the same «شروط التسجيل» every door shows. */}
      <SheetModal visible={!!accepting} onClose={() => setAccepting(null)} avoidKeyboard style={{ backgroundColor: colors.background, maxHeight: '90%', paddingBottom: insets.bottom + spacing.lg }}>
            <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('booking_requests.accept_confirm_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
                {accepting ? t('booking_requests.accept_confirm_hint', { name: accepting.student_name, course: accepting.course_name ?? '' }) : ''}
              </Text>
              <EnrollmentTermsSheet terms={terms} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <TouchableOpacity onPress={() => setAccepting(null)} disabled={accept.isPending} activeOpacity={0.85}
                  style={{ flex: 1, height: 50, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => accepting && accept.mutate(accepting)} disabled={accept.isPending || terms.overpaid || terms.isLoading} activeOpacity={0.85}
                  style={{ flex: 2, height: 50, borderRadius: radius.lg, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', opacity: terms.overpaid ? 0.5 : 1 }}>
                  {accept.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('booking_requests.accept')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
      </SheetModal>
    </View>
  );
}
