import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '@/ui/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { TimePicker } from '@/components/ui/TimePicker';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/ui/surfaces';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormScreen, FormCard, Field, Input, NumberInput, Chips, DayPicker, OptionRow, SwitchRow, DateField, TimeRangeRow } from '@/components/ui/Form';
import { SelectField } from '@/components/ui/SelectField';
import { getRevisionCreateOptions, createRevision, type BillingMode } from '@/api/revisions';

const DURATIONS = [{ m: 60, l: 'ساعة' }, { m: 90, l: 'ساعة ونصف' }, { m: 120, l: 'ساعتان' }, { m: 180, l: '3 ساعات' }, { m: 240, l: '4 ساعات' }, { m: 300, l: '5 ساعات' }];

/**
 * Special / revision session creation — parity with the web revise/create: purpose
 * (revision / exam) + max mark, same-grade course picker, billing free / bucket / spread
 * (+ fee), one-time or weekly timing, duration, location, notify students.
 *
 * «من مجموعاتي» or «مخصّصة» (founder 2026-11-06): a custom one is not tied to a group — any
 * grade, in a chosen academic year. The teacher or an assistant with «إدارة الحصص» makes it.
 */
export default function RevisionCreate() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: options, isLoading } = useQuery({ queryKey: ['revision-create-options'], queryFn: getRevisionCreateOptions });
  const grades = options?.grades;
  // A server that predates custom revisions sends no years: only the groups way is offered.
  const customOffered = (options?.terms.length ?? 0) > 0 && (options?.all_grades.length ?? 0) > 0;
  const groupsOffered = (grades ?? []).length > 0;

  // «امتحان جديد» from the revision desk opens the form already set to an exam.
  const params = useLocalSearchParams<{ purpose?: string }>();
  const [purpose, setPurpose] = useState<'revision' | 'quiz_exam'>(params.purpose === 'quiz_exam' ? 'quiz_exam' : 'revision');
  const [maxMark, setMaxMark] = useState('');
  const [title, setTitle] = useState('');
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [members, setMembers] = useState<number[]>([]); // selected COURSE ids (course-level merge)
  const [billing, setBilling] = useState<BillingMode>('free');
  const [feeTotal, setFeeTotal] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState('');       // one-time: YYYY-MM-DD
  const [otTime, setOtTime] = useState('');    // one-time: HH:mm
  const [day, setDay] = useState(6);           // recurring day
  const [start, setStart] = useState('');      // recurring start HH:mm
  const [end, setEnd] = useState('');          // recurring end HH:mm
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<'groups' | 'custom'>('groups');
  const [termId, setTermId] = useState<number | null>(null);
  const [customGrade, setCustomGrade] = useState<string | null>(null);
  const custom = source === 'custom';
  // No groups yet: the custom way is the only way. The current year is the default.
  useEffect(() => { if (options && !groupsOffered && customOffered) setSource('custom'); }, [options, groupsOffered, customOffered]);
  useEffect(() => { if (termId == null && options?.terms.length) setTermId((options.terms.find((x) => x.is_current) ?? options.terms[0]).id); }, [options, termId]);

  const grade = useMemo(() => (grades ?? []).find((g) => g.grade_id === gradeId), [grades, gradeId]);
  const isExam = purpose === 'quiz_exam';
  const toggleMember = (id: number) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const selectGrade = (id: number) => { setGradeId(id); setMembers([]); };

  const pickedGrade = custom ? (customGrade ? Number(customGrade) : null) : gradeId;
  const canSubmit = title.trim().length > 0 && pickedGrade != null && (custom ? termId != null : members.length > 0)
    && (!isExam || Number(maxMark) > 0) && (billing !== 'spread' || Number(feeTotal) > 0)
    && (recurring ? !!start : !!date && !!otTime) && !busy;

  const submit = async () => {
    if (!canSubmit || pickedGrade == null) return;
    setBusy(true);
    try {
      const res = await createRevision({
        mode: source, academic_session_id: custom ? termId : null,
        title: title.trim(), grade_id: pickedGrade, purpose,
        max_mark: isExam ? Number(maxMark) : null,
        billing_mode: billing, fee_total: billing === 'spread' ? Number(feeTotal) : null,
        course_ids: custom ? [] : members, is_recurring: recurring,
        day_of_week: recurring ? day : null, start_time: recurring ? start : null, end_time: recurring ? (end || null) : null,
        one_time_at: !recurring ? `${date} ${otTime}` : null,
        duration_minutes: duration || 60, location: location.trim() || null, notify_students: notify,
      });
      qc.invalidateQueries({ queryKey: ['revisions'] });
      Alert.alert(t('revision_create.done'), res.title, [{ text: t('common.ok'), onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('revision_create.failed'));
    } finally {
      setBusy(false);
    }
  };

  const tint = isExam ? colors.accent : colors.brand;

  return (
    <Surface id="screen.teacher.revision-create" screen>
    <FormScreen title={t('revision_create.title')} loading={isLoading}>
      {!groupsOffered && !customOffered ? (
        <EmptyState icon="book" title={t('revision_create.no_groups')} />
      ) : (
        <>
          <Surface id="teacher.revision_create.type">
          <FormCard icon={isExam ? 'trophy' : 'book'} title={t('revision_create.type')} tint={tint}>
            <Chips fill tint={tint}
              options={[{ key: 'revision' as const, label: t('revision_create.revision'), icon: 'book' }, { key: 'quiz_exam' as const, label: t('revision_create.exam'), icon: 'trophy' }]}
              value={purpose} onChange={setPurpose} />
            <Field label={t('revision_create.session_title')} required>
              <Input value={title} onChangeText={setTitle} placeholder={t('revision_create.title_ph')} maxLength={120} />
            </Field>
            {isExam ? (
              <Surface id="teacher.revision_create.type.max_mark">
              <Field label={t('revision_create.max_mark')} required>
                <NumberInput value={maxMark} onChangeText={setMaxMark} placeholder="50" />
              </Field>
              </Surface>
            ) : null}
          </FormCard>
          </Surface>

          <Surface id="teacher.revision_create.grade">
          <FormCard icon="children" title={customOffered ? t('revision_create.source') : t('revision_create.grade')} required
            hint={custom ? t('revision_create.source_custom_hint') : grade ? t('revision_create.merge_courses') : customOffered ? t('revision_create.source_groups_hint') : t('revision_create.pick_grade')}>
            {customOffered && groupsOffered ? (
              <Surface id="teacher.revision_create.grade.source">
              <Chips fill
                options={[{ key: 'groups' as const, label: t('revision_create.source_groups'), icon: 'children' }, { key: 'custom' as const, label: t('revision_create.source_custom'), icon: 'add' }]}
                value={source} onChange={setSource} />
              </Surface>
            ) : null}
            {custom ? (
              <>
                {/* Any academic year, any grade — not tied to one of the teacher's groups. */}
                <Field label={t('revision_create.year')} required>
                  <Chips options={(options?.terms ?? []).map((tm) => ({ key: tm.id, label: tm.name }))} value={termId} onChange={setTermId} />
                </Field>
                <Field label={t('revision_create.grade')} required>
                  <SelectField value={customGrade} options={(options?.all_grades ?? []).map((g) => ({ key: String(g.grade_id), label: g.grade_name }))}
                    placeholder={t('revision_create.pick_grade_custom')} onChange={setCustomGrade} />
                </Field>
              </>
            ) : (
              <>
                <View style={{ marginTop: customOffered ? spacing.md : 0 }}>
                  <Chips options={(grades ?? []).map((g) => ({ key: g.grade_id, label: g.grade_name }))} value={gradeId} onChange={selectGrade} />
                </View>
                {grade ? (
                  <View style={{ marginTop: spacing.md }}>
                    {/* Course-level: one checkbox per COURSE — all its weekly days come with it. */}
                    {grade.courses.map((c) => <OptionRow key={c.course_id} mode="check" title={c.name} sub={c.slots_label} selected={members.includes(c.course_id)} onPress={() => toggleMember(c.course_id)} />)}
                  </View>
                ) : null}
              </>
            )}
          </FormCard>
          </Surface>

          <Surface id="teacher.revision_create.billing">
          <FormCard icon="money" title={t('revision_create.billing')} tint={colors.success}>
            <Chips fill tint={colors.success}
              options={[{ key: 'free' as BillingMode, label: t('revision_create.bill_free') }, { key: 'bucket' as BillingMode, label: t('revision_create.bill_bucket') }, { key: 'spread' as BillingMode, label: t('revision_create.bill_spread') }]}
              value={billing} onChange={setBilling} />
            {billing === 'spread' ? (
              <Surface id="teacher.revision_create.billing.fee_total">
              <Field label={t('revision_create.fee_total')} required>
                <NumberInput value={feeTotal} onChangeText={setFeeTotal} decimals placeholder="0" suffix={t('teacher.egp')} />
              </Field>
              </Surface>
            ) : null}
          </FormCard>
          </Surface>

          <Surface id="teacher.revision_create.timing">
          <FormCard icon="calendar" title={t('revision_create.timing')} required tint={colors.accent}>
            <Chips fill tint={colors.accent}
              options={[{ key: 'once', label: t('revision_create.once'), icon: 'calendar' }, { key: 'weekly', label: t('revision_create.weekly'), icon: 'refresh' }]}
              value={recurring ? 'weekly' : 'once'} onChange={(k) => setRecurring(k === 'weekly')} />
            {recurring ? (
              <>
                <Field label={t('revision_create.day')}><DayPicker value={day} onChange={setDay} tint={colors.accent} /></Field>
                <Field label={t('revision_create.start_time')} required>
                  <TimeRangeRow>
                    <View style={{ flex: 1 }}><TimePicker value={start || null} onChange={setStart} /></View>
                    <Text style={{ fontFamily: fonts.bold, color: colors.textTertiary }}>–</Text>
                    <View style={{ flex: 1 }}><TimePicker value={end || null} onChange={setEnd} /></View>
                  </TimeRangeRow>
                </Field>
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1.3 }}><Field label={t('revision_create.date')} required><DateField value={date || null} onChange={setDate} /></Field></View>
                <View style={{ flex: 1 }}><Field label={t('revision_create.time')} required><TimePicker value={otTime || null} onChange={setOtTime} /></Field></View>
              </View>
            )}
            <Surface id="teacher.revision_create.timing.duration">
            <Field label={isExam ? t('revision_create.exam_duration') : t('revision_create.duration')}>
              {/* Fixed hour choices — the teacher picks whole hours, no minutes math. */}
              <Chips options={DURATIONS.map((d) => ({ key: d.m, label: d.l }))} value={duration} onChange={setDuration} tint={colors.accent} />
            </Field>
            </Surface>
            <Surface id="teacher.revision_create.timing.location">
            <Field label={t('revision_create.location')} hint={t('form_ui.optional')}>
              <Input value={location} onChangeText={setLocation} placeholder={t('teacher.optional')} maxLength={120} />
            </Field>
            </Surface>
          </FormCard>
          </Surface>

          <Surface id="teacher.revision_create.notify">
          <FormCard icon="bell" title={t('revision_create.notify')} hint={t('revision_create.notify_hint')}>
            <SwitchRow title={t('revision_create.notify')} value={notify} onChange={setNotify} first />
          </FormCard>
          </Surface>

          <Surface id="teacher.revision_create.submit_button"><Button title={t('revision_create.submit')} onPress={submit} loading={busy} disabled={!canSubmit} variant="primary" /></Surface>
        </>
      )}
    </FormScreen>
    </Surface>
  );
}
