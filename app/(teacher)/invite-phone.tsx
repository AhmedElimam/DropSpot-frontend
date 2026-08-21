import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert, Switch } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  getInvitationOptions, createInvitation,
  type BookingSecures, type CreateInvitationPayload, type DedupeMatch,
} from '@/api/invitation';

const SECURES: { key: BookingSecures; label: string }[] = [
  { key: 'session', label: 'حصة قادمة' },
  { key: 'booklet', label: 'الملزمة' },
  { key: 'flat', label: 'حجز مبدئي' },
];

/**
 * Phone invitation — full parity with the web /invitations page: pick a course
 * (with its meeting days/times) + term, enter the student's and/or parent's phone
 * and name, optionally set the booking down-payment, and send the SMS invite. A
 * parent-phone match surfaces the same "same student?" dedupe prompt as the web.
 */
export default function InvitePhone() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const { data: options, isLoading, isError, refetch } = useQuery({
    queryKey: ['invitation-options'],
    queryFn: getInvitationOptions,
  });

  const [courseId, setCourseId] = useState<number | null>(null);
  const [termId, setTermId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [secures, setSecures] = useState<BookingSecures | null>(null);
  const [downPayment, setDownPayment] = useState('');
  const [downPaid, setDownPaid] = useState('');
  // Per-student override of the teacher's requires_down_payment default, matching the
  // web invite form. null = follow the teacher setting until explicitly toggled.
  const [bookingOn, setBookingOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<DedupeMatch[] | null>(null);

  const course = useMemo(() => options?.courses.find((c) => c.id === courseId) ?? null, [options, courseId]);
  const eligible = useMemo(() => (options?.courses ?? []).filter((c) => c.has_schedule), [options]);

  const selectCourse = (id: number) => {
    setCourseId(id);
    const c = options?.courses.find((x) => x.id === id);
    setTermId(c?.academic_session_id ?? termId);
    if (options?.requires_down_payment && !secures) setSecures(options.default_secures);
  };

  // The switch defaults to the teacher's setting but can be flipped either way per
  // student — a teacher who normally takes a دفعة can waive it for one family, and
  // one who normally doesn't can charge a single student.
  const dpEnabled = bookingOn ?? !!options?.requires_down_payment;
  const showDpSection = courseId != null;

  // Live remainder, so the teacher sees the exact figure the family's app will show.
  const dpTotalNum = Number(downPayment) || 0;
  const dpPaidNum = Number(downPaid) || 0;
  const dpOverpaid = dpPaidNum > dpTotalNum && dpTotalNum > 0;
  const dpHint = dpOverpaid
    ? t('invite_phone.paid_over')
    : dpTotalNum > 0 && dpPaidNum > 0
      ? t('invite_phone.paid_remaining').replace('{amount}', (dpTotalNum - dpPaidNum).toFixed(2))
      : t('invite_phone.paid_hint');

  const canSubmit = courseId != null && termId != null
    && (studentPhone.trim().length >= 6 || parentPhone.trim().length >= 6)
    && !busy;

  const buildPayload = (extra?: Partial<CreateInvitationPayload>): CreateInvitationPayload => ({
    course_id: courseId!,
    academic_session_id: termId!,
    grade_id: course?.grade_id ?? null,
    invited_student_name: name.trim() || undefined,
    student_phone: studentPhone.trim() || undefined,
    parent_phone: parentPhone.trim() || undefined,
    // Toggle OFF still sends the key with a null amount — the API reads that as an
    // explicit "no دفعة for this student" and skips the charge, rather than falling
    // back to the teacher/course default (which omitting the key would do).
    ...(showDpSection
      ? {
          down_payment_amount: !dpEnabled || downPayment.trim() === '' ? null : Number(downPayment),
          down_payment_paid: !dpEnabled || downPaid.trim() === '' ? null : Number(downPaid),
          booking_secures: secures ?? options?.default_secures,
        }
      : {}),
    ...extra,
  });

  const send = async (extra?: Partial<CreateInvitationPayload>) => {
    if (courseId == null || termId == null) return;
    setBusy(true);
    try {
      const res = await createInvitation(buildPayload(extra));
      if (res.kind === 'dedupe') {
        setMatches(res.matches);
        return;
      }
      if (res.kind === 'grade_mismatch') {
        // Linking an existing student whose saved grade differs from the course —
        // ask, then resend accepting the mismatch (keeping the same link decision).
        Alert.alert(t('enroll.grade_mismatch_title'), res.message, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('enroll.enroll_anyway'), onPress: () => send({ ...extra, accept_grade_mismatch: true }) },
        ]);
        return;
      }
      setMatches(null);
      Alert.alert('', res.kind === 'linked' ? t('invite_phone.linked') : t('invite_phone.sent'), [
        { text: t('common.close'), onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('invite_phone.failed'));
    } finally {
      setBusy(false);
    }
  };

  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg } as const;
  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
  const Lbl = ({ children }: { children: string }) => (
    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{children}</Text>
  );

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }
  if (isError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}><ErrorState onRetry={() => refetch()} /></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Icon name="forward" size={22} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('invite_phone.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        {eligible.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>{t('invite_phone.no_courses')}</Text>
        ) : (
          <>
            {/* Course */}
            <View style={card}>
              <Lbl>{t('invite_phone.course')}</Lbl>
              {eligible.map((c) => {
                const active = courseId === c.id;
                return (
                  <TouchableOpacity key={c.id} onPress={() => selectCourse(c.id)} activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                      {active ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{c.name}{c.grade_name ? ` · ${c.grade_name}` : ''}</Text>
                      {c.schedule_label ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{c.schedule_label}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Term */}
            {(options?.terms.length ?? 0) > 1 ? (
              <View style={card}>
                <Lbl>{t('invite_phone.term')}</Lbl>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {options!.terms.map((tm) => {
                    const active = termId === tm.id;
                    return (
                      <TouchableOpacity key={tm.id} onPress={() => setTermId(tm.id)} activeOpacity={0.8}
                        style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand + '18' : colors.surface }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.brand : colors.textSecondary }}>{tm.name}{tm.is_current ? ' ●' : ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Student + phones */}
            <View style={card}>
              <Lbl>{t('invite_phone.student_name')}</Lbl>
              <TextInput value={name} onChangeText={setName} placeholder={t('invite_phone.name_ph')} placeholderTextColor={colors.textTertiary} maxLength={120} style={input} />

              <View style={{ height: spacing.md }} />
              <Lbl>{t('invite_phone.student_phone')}</Lbl>
              <TextInput value={studentPhone} onChangeText={(v) => setStudentPhone(v.replace(/[^0-9]/g, ''))} keyboardType="phone-pad" placeholder="01xxxxxxxxx" placeholderTextColor={colors.textTertiary} maxLength={15} style={{ ...input, textAlign: 'left' }} />

              <View style={{ height: spacing.md }} />
              <Lbl>{t('invite_phone.parent_phone')}</Lbl>
              <TextInput value={parentPhone} onChangeText={(v) => setParentPhone(v.replace(/[^0-9]/g, ''))} keyboardType="phone-pad" placeholder="01xxxxxxxxx" placeholderTextColor={colors.textTertiary} maxLength={15} style={{ ...input, textAlign: 'left' }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>{t('invite_phone.phone_hint')}</Text>
            </View>

            {/* Booking down-payment — an explicit per-student switch (parity with the
                web invite form), defaulting to the teacher's requires_down_payment. */}
            {showDpSection ? (
              <View style={card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>
                    {t('invite_phone.booking_toggle')}
                  </Text>
                  <Switch
                    value={dpEnabled}
                    onValueChange={setBookingOn}
                    trackColor={{ true: colors.brand, false: colors.border }}
                  />
                </View>

                {dpEnabled ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Lbl>{t('invite_phone.down_payment')}</Lbl>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                      {SECURES.map((s) => {
                        const active = (secures ?? options?.default_secures) === s.key;
                        return (
                          <TouchableOpacity key={s.key} onPress={() => setSecures(s.key)} activeOpacity={0.8}
                            style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand + '18' : colors.surface }}>
                            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.brand : colors.textSecondary }}>{s.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TextInput
                      value={downPayment}
                      onChangeText={(v) => setDownPayment(v.replace(/[^0-9.]/g, ''))}
                      keyboardType="numeric"
                      placeholder={course?.booking_price != null ? String(course.booking_price) : t('invite_phone.amount_ph')}
                      placeholderTextColor={colors.textTertiary}
                      style={input}
                    />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>{t('invite_phone.amount_hint')}</Text>

                    <View style={{ marginTop: spacing.md }}>
                      <Lbl>{t('invite_phone.paid_now')}</Lbl>
                      <TextInput
                        value={downPaid}
                        onChangeText={(v) => setDownPaid(v.replace(/[^0-9.]/g, ''))}
                        keyboardType="numeric"
                        placeholder={t('invite_phone.paid_ph')}
                        placeholderTextColor={colors.textTertiary}
                        style={input}
                      />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: dpOverpaid ? colors.warning : colors.textTertiary, marginTop: spacing.sm }}>
                        {dpHint}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity onPress={() => send()} disabled={!canSubmit} activeOpacity={0.85}
              style={{ minHeight: 52, borderRadius: radius.lg, backgroundColor: canSubmit ? colors.brand : colors.border, justifyContent: 'center', alignItems: 'center' }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('invite_phone.send')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Dedupe prompt — same student on this parent phone? */}
      <Modal visible={!!matches} transparent animationType="fade" onRequestClose={() => setMatches(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.xl }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.sm }}>{t('invite_phone.dedupe_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('invite_phone.dedupe_body')}</Text>
            {(matches ?? []).map((m) => (
              <TouchableOpacity key={m.id} onPress={() => send({ dedupe_decision: 'link', link_student_id: m.id })} disabled={busy} activeOpacity={0.85}
                style={{ borderWidth: 1, borderColor: colors.brand, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('invite_phone.same_student')}: {m.name ?? `#${m.id}`}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => send({ dedupe_decision: 'new' })} disabled={busy} activeOpacity={0.85}
              style={{ backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff', textAlign: 'center' }}>{t('invite_phone.new_student')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMatches(null)} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
