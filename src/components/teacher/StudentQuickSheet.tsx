import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { SheetModal } from '@/components/ui/SheetModal';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { useStudentDetail } from '@/hooks/useStudents';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { formatDayDate, formatNumber } from '@/utils/format';
import { StudentDuesCard, CollectForm, collectTarget, parseCollectAmount, type CollectTarget } from '@/components/teacher/StudentDues';

const STATUS_LABEL: Record<string, string> = { present: 'حاضر', late: 'متأخر', absent: 'غائب', excused: 'بعذر' };
// Live tokens (the scheme can change under a mounted sheet): read at render, not at import.
const tone = (status: string) => ({
  present: { fg: colors.successText, bg: colors.successLight },
  late: { fg: colors.warningText, bg: colors.warningLight },
  absent: { fg: colors.dangerText, bg: colors.dangerLight },
  excused: { fg: colors.infoText, bg: colors.infoLight },
} as Record<string, { fg: string; bg: string }>)[status] ?? { fg: colors.textSecondary, bg: colors.surfaceSunken };

/**
 * The student, without leaving the collections list (founder 2026-10-06: «on clicking a
 * student it shows the student details like the details page, but in a modal — and be aware
 * of the keyboard»). Who they are, how they attend, what they owe — collectable here — their
 * courses, the people to call, and the last sessions; the full page is one tap away.
 *
 * Collecting swaps the sheet's content for the amount form instead of stacking a second sheet
 * (a modal over a modal fights for the keyboard and the swipe). The sheet is keyboard-aware:
 * it lifts above the keyboard and scrolls the amount field into view.
 */
export function StudentQuickSheet({ studentId, onClose }: { studentId: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { can } = useActiveAbilities();
  const canCollect = can(ABILITY.SCAN);
  const id = studentId != null ? String(studentId) : undefined;
  const { data: s, isLoading, isError, refetch } = useStudentDetail(id);

  const [target, setTarget] = useState<CollectTarget | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  // A new student opens on their details, never on the previous one's collect form.
  useEffect(() => { setTarget(null); }, [studentId]);

  const close = () => { if (!busy) { setTarget(null); onClose(); } };
  const openFull = () => { const go = id; close(); if (go) router.push(`/(teacher)/students/${go}` as Href); };

  const submit = async () => {
    if (!target || !s || !id) return;
    const parsed = parseCollectAmount(amount, target);
    if ('error' in parsed) { Alert.alert('', parsed.error); return; }
    setBusy(true);
    try {
      const msg = await collectTarget(id, target, parsed.amount, s.billing);
      setTarget(null);
      Alert.alert('تم', msg);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message || 'تعذّر التحصيل');
    } finally {
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ['pending-collections'] })]);
      setBusy(false);
    }
  };

  const primary = s?.parents.find((p) => p.is_primary && p.phone) ?? s?.parents.find((p) => p.phone);
  const recent = (s?.attendance ?? []).slice(0, 5);

  return (
    <SheetModal visible={studentId != null} onClose={close} avoidKeyboard>
      {isLoading || (!s && !isError) ? (
        <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : !s ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.md }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>تعذّر تحميل بيانات الطالب</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : target ? (
        // ── collect ──
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <TouchableOpacity onPress={() => !busy && setTarget(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')}
              style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="forward" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{`تحصيل — ${target.label}`}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>{s.name}</Text>
            </View>
          </View>
          <CollectForm target={target} amount={amount} onAmount={setAmount} busy={busy} onSubmit={submit} />
        </View>
      ) : (
        // ── details ──
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ borderRadius: 16, overflow: 'hidden' }}>
              <GeneratedAvatar seed={avatarSeed.student(s.id, s.name ?? '—')} size={54} square label={s.name ?? ''} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary }} numberOfLines={2}>{s.name ?? '—'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
                {[s.grade_name ?? t('teacher.no_grade'), s.student_code].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* How they attend, at a glance. */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            {[
              { v: s.attendance_stats.attended, label: t('teacher.stat_attended'), fg: colors.successText, bg: colors.successLight },
              { v: s.attendance_stats.absent, label: t('teacher.stat_absent'), fg: s.attendance_stats.absent > 0 ? colors.dangerText : colors.textPrimary, bg: s.attendance_stats.absent > 0 ? colors.dangerLight : colors.surfaceSunken },
              { v: s.attendance_stats.excused, label: t('teacher.stat_excused'), fg: colors.infoText, bg: colors.surfaceSunken },
            ].map((x) => (
              <View key={x.label} style={{ flex: 1, backgroundColor: x.bg, borderRadius: radius.lg, paddingVertical: spacing.sm, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: x.fg }}>{formatNumber(x.v)}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }}>{x.label}</Text>
              </View>
            ))}
          </View>

          {/* Who to call: the student, and the parent who answers for them. */}
          {s.phone || primary ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {s.phone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${s.phone}`)} accessibilityRole="button" activeOpacity={0.85}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm }}>
                  <Icon name="call" size={17} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>الطالب</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, writingDirection: 'ltr', textAlign: 'right' }} numberOfLines={1}>{s.phone}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {primary ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${primary.phone}`)} accessibilityRole="button" activeOpacity={0.85}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: primary.number_flagged ? colors.danger : colors.border, padding: spacing.sm }}>
                  <Icon name="call" size={17} color={primary.number_flagged ? colors.danger : colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>{primary.relationship || 'ولي الأمر'}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, writingDirection: 'ltr', textAlign: 'right' }} numberOfLines={1}>{primary.phone}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* What they owe — every charge collectable right here. */}
          <View style={{ marginTop: spacing.md }}>
            <StudentDuesCard billing={s.billing} canCollect={canCollect} onCollect={(tg) => { setAmount(String(tg.remaining)); setTarget(tg); }} />
          </View>

          {/* Their courses and where each cycle stands. */}
          {s.courses.length > 0 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
              {s.courses.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                  <Icon name="book" size={16} color={colors.brand} outline />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>{c.name ?? '—'}</Text>
                  {c.cycle?.has_cycle ? (
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{`حضر ${c.cycle.attended}/${c.cycle.held} · الحصة ${c.cycle.position}/${c.cycle.threshold}`}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* The last sessions, newest first. */}
          {recent.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>آخر الحصص</Text>
              {recent.map((r) => {
                const tn = tone(r.status);
                return (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 }}>
                    <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textPrimary }} numberOfLines={1}>
                      {[r.date ? formatDayDate(r.date) : null, r.course_name].filter(Boolean).join(' · ')}
                    </Text>
                    <View style={{ backgroundColor: tn.bg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: tn.fg }}>{STATUS_LABEL[r.status] ?? r.status}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {s.parent_number_notice ? (
            <View style={{ marginTop: spacing.sm }}>
              <Badge label={s.parent_number_notice_message ?? t('teacher.number_fake')} variant="danger" size="sm" />
            </View>
          ) : null}

          <TouchableOpacity onPress={openFull} accessibilityRole="button" activeOpacity={0.85}
            style={{ marginTop: spacing.lg, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Icon name="profile" size={18} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.brand }}>الملف الكامل</Text>
            <Icon name="back" size={16} color={colors.brand} />
          </TouchableOpacity>
        </View>
      )}
    </SheetModal>
  );
}
