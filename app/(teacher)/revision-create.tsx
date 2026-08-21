import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { getRevisionCreateOptions, createRevision, type BillingMode } from '@/api/revisions';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/**
 * Special/revision session creation — full parity with the web revise/create:
 * purpose (revision/exam) + max mark, same-grade merge picker, billing free/bucket/
 * spread (+ fee), one-time or recurring timing, duration, location, notify students.
 */
export default function RevisionCreate() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: grades, isLoading } = useQuery({ queryKey: ['revision-create-options'], queryFn: getRevisionCreateOptions });

  const [purpose, setPurpose] = useState<'revision' | 'quiz_exam'>('revision');
  const [maxMark, setMaxMark] = useState('');
  const [title, setTitle] = useState('');
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [members, setMembers] = useState<number[]>([]);
  const [billing, setBilling] = useState<BillingMode>('free');
  const [feeTotal, setFeeTotal] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState('');       // one-time: YYYY-MM-DD
  const [otTime, setOtTime] = useState('');    // one-time: HH:mm
  const [day, setDay] = useState(0);           // recurring day
  const [start, setStart] = useState('');      // recurring start HH:mm
  const [end, setEnd] = useState('');          // recurring end HH:mm
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const grade = useMemo(() => (grades ?? []).find((g) => g.grade_id === gradeId), [grades, gradeId]);
  const isExam = purpose === 'quiz_exam';

  const toggleMember = (id: number) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const selectGrade = (id: number) => { setGradeId(id); setMembers([]); };

  const canSubmit =
    title.trim().length > 0 &&
    gradeId != null &&
    members.length > 0 &&
    (!isExam || Number(maxMark) > 0) &&
    (billing !== 'spread' || Number(feeTotal) > 0) &&
    (recurring ? !!start : !!date && !!otTime) &&
    !busy;

  const submit = async () => {
    if (!canSubmit || gradeId == null) return;
    setBusy(true);
    try {
      const res = await createRevision({
        title: title.trim(),
        grade_id: gradeId,
        purpose,
        max_mark: isExam ? Number(maxMark) : null,
        billing_mode: billing,
        fee_total: billing === 'spread' ? Number(feeTotal) : null,
        members,
        is_recurring: recurring,
        day_of_week: recurring ? day : null,
        start_time: recurring ? start : null,
        end_time: recurring ? (end || null) : null,
        one_time_at: !recurring ? `${date} ${otTime}` : null,
        duration_minutes: Number(duration) || 60,
        location: location.trim() || null,
        notify_students: notify,
      });
      qc.invalidateQueries({ queryKey: ['revisions'] });
      Alert.alert(t('revision_create.done'), res.title, [{ text: t('common.ok'), onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('revision_create.failed'));
    } finally {
      setBusy(false);
    }
  };

  const card = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg } as const;
  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };

  const Seg = ({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: any) => void }) => (
    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <TouchableOpacity key={o.key} onPress={() => onChange(o.key)} activeOpacity={0.85}
          style={{ paddingHorizontal: spacing.lg, height: 44, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1.5, borderColor: value === o.key ? colors.brand : colors.border, backgroundColor: value === o.key ? colors.brandTint : colors.surface }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: value === o.key ? colors.brand : colors.textSecondary }}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  const Lbl = ({ children }: { children: string }) => (
    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{children}</Text>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Icon name="forward" size={22} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('revision_create.title')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xxl }} />
      ) : (grades ?? []).length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>{t('revision_create.no_groups')}</Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}>
          {/* Purpose */}
          <View style={card}>
            <Lbl>{t('revision_create.type')}</Lbl>
            <Seg options={[{ key: 'revision', label: t('revision_create.revision') }, { key: 'quiz_exam', label: t('revision_create.exam') }]} value={purpose} onChange={setPurpose} />
            {isExam ? (
              <View style={{ marginTop: spacing.md }}>
                <Lbl>{t('revision_create.max_mark')}</Lbl>
                <TextInput value={maxMark} onChangeText={(v) => setMaxMark(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="50" placeholderTextColor={colors.textTertiary} style={input} />
              </View>
            ) : null}
          </View>

          {/* Title */}
          <View style={card}>
            <Lbl>{t('revision_create.session_title')}</Lbl>
            <TextInput value={title} onChangeText={setTitle} placeholder={t('revision_create.title_ph')} placeholderTextColor={colors.textTertiary} maxLength={120} style={input} />
          </View>

          {/* Grade + members */}
          <View style={card}>
            <Lbl>{t('revision_create.grade')}</Lbl>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {(grades ?? []).map((g) => (
                <TouchableOpacity key={g.grade_id} onPress={() => selectGrade(g.grade_id)} activeOpacity={0.85}
                  style={{ paddingHorizontal: spacing.md, height: 40, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: gradeId === g.grade_id ? colors.brand : colors.border, backgroundColor: gradeId === g.grade_id ? colors.brandTint : colors.surface }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: gradeId === g.grade_id ? colors.brand : colors.textSecondary }}>{g.grade_name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {grade ? (
              <View style={{ marginTop: spacing.md }}>
                <Lbl>{t('revision_create.merge_groups')}</Lbl>
                {grade.courses.map((c) => (
                  <View key={c.course_id} style={{ marginBottom: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand, marginBottom: 4 }}>{c.name}</Text>
                    {c.schedules.map((s) => (
                      <TouchableOpacity key={s.id} onPress={() => toggleMember(s.id)} activeOpacity={0.8}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: members.includes(s.id) ? colors.brand : colors.border, backgroundColor: members.includes(s.id) ? colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {members.includes(s.id) ? <Icon name="success" size={14} color="#fff" /> : null}
                        </View>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>{t('revision_create.pick_grade')}</Text>
            )}
          </View>

          {/* Billing */}
          <View style={card}>
            <Lbl>{t('revision_create.billing')}</Lbl>
            <Seg
              options={[{ key: 'free', label: t('revision_create.bill_free') }, { key: 'bucket', label: t('revision_create.bill_bucket') }, { key: 'spread', label: t('revision_create.bill_spread') }]}
              value={billing} onChange={setBilling}
            />
            {billing === 'spread' ? (
              <View style={{ marginTop: spacing.md }}>
                <Lbl>{t('revision_create.fee_total')}</Lbl>
                <TextInput value={feeTotal} onChangeText={(v) => setFeeTotal(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textTertiary} style={input} />
              </View>
            ) : null}
          </View>

          {/* Timing */}
          <View style={card}>
            <Lbl>{t('revision_create.timing')}</Lbl>
            <Seg options={[{ key: 'once', label: t('revision_create.once') }, { key: 'weekly', label: t('revision_create.weekly') }]} value={recurring ? 'weekly' : 'once'} onChange={(k) => setRecurring(k === 'weekly')} />

            {recurring ? (
              <>
                <View style={{ marginTop: spacing.md }}>
                  <Lbl>{t('revision_create.day')}</Lbl>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                    {DAYS.map((d, i) => (
                      <TouchableOpacity key={i} onPress={() => setDay(i)} activeOpacity={0.85}
                        style={{ paddingHorizontal: spacing.sm, height: 38, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: day === i ? colors.brand : colors.border, backgroundColor: day === i ? colors.brandTint : colors.surface }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: day === i ? colors.brand : colors.textSecondary }}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <View style={{ flex: 1 }}><Lbl>{t('revision_create.start_time')}</Lbl>
                    <TextInput value={start} onChangeText={setStart} placeholder="09:00" placeholderTextColor={colors.textTertiary} style={input} /></View>
                  <View style={{ flex: 1 }}><Lbl>{t('revision_create.end_time')}</Lbl>
                    <TextInput value={end} onChangeText={setEnd} placeholder="10:00" placeholderTextColor={colors.textTertiary} style={input} /></View>
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1.4 }}><Lbl>{t('revision_create.date')}</Lbl>
                  <TextInput value={date} onChangeText={setDate} placeholder="2026-08-20" placeholderTextColor={colors.textTertiary} style={{ ...input, textAlign: 'left' }} /></View>
                <View style={{ flex: 1 }}><Lbl>{t('revision_create.time')}</Lbl>
                  <TextInput value={otTime} onChangeText={setOtTime} placeholder="18:00" placeholderTextColor={colors.textTertiary} style={{ ...input, textAlign: 'left' }} /></View>
              </View>
            )}

            <View style={{ marginTop: spacing.md }}>
              <Lbl>{isExam ? t('revision_create.exam_duration') : t('revision_create.duration')}</Lbl>
              {/* Fixed hour choices — the teacher picks whole hours, no minutes math. */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {[{ m: 60, l: 'ساعة' }, { m: 90, l: 'ساعة ونصف' }, { m: 120, l: 'ساعتان' }, { m: 180, l: '3 ساعات' }, { m: 240, l: '4 ساعات' }, { m: 300, l: '5 ساعات' }].map((opt) => {
                  const active = Number(duration) === opt.m;
                  return (
                    <TouchableOpacity
                      key={opt.m}
                      onPress={() => setDuration(String(opt.m))}
                      activeOpacity={0.8}
                      style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand + '18' : colors.surface }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.brand : colors.textSecondary }}>{opt.l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Lbl>{t('revision_create.location')}</Lbl>
              <TextInput value={location} onChangeText={setLocation} placeholder={t('teacher.optional')} placeholderTextColor={colors.textTertiary} maxLength={120} style={input} />
            </View>
          </View>

          {/* Notify */}
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingEnd: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('revision_create.notify')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('revision_create.notify_hint')}</Text>
              </View>
              <Switch value={notify} onValueChange={setNotify} trackColor={{ true: colors.brand }} />
            </View>
          </View>

          <TouchableOpacity onPress={submit} disabled={!canSubmit} activeOpacity={0.85}
            style={{ opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('revision_create.submit')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
