import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { Surface } from '@/ui/surfaces';
import { useDialogPersona } from '@/ui/dialog';
import { NazerFace } from '@/components/nazer/NazerFace';
import { NazerStamp } from '@/components/nazer/NazerStamp';
import { studentSay } from '@/nazer/mood';
import { useCoverageStats, useStudentAttendanceRisk } from '@/hooks/useAttendance';
import { useStudentBillingStatus } from '@/hooks/useInvoices';
import { useTodaySessions, useUpcomingSessions } from '@/hooks/useSessions';
import { formatEGP } from '@/utils/currency';
import { formatDayDate, formatTime } from '@/utils/format';

type Tone = 'success' | 'warning' | 'danger' | 'info';
interface Note { id: string; icon: IconName; tone: Tone; title: string; route?: Href }

const TONES = (): Record<Tone, { bg: string; fg: string }> => ({
  success: { bg: colors.successLight, fg: colors.success },
  warning: { bg: colors.warningLight, fg: colors.warningDark },
  danger: { bg: colors.dangerLight, fg: colors.danger },
  info: { bg: colors.brandTint, fg: colors.brand },
});

/**
 * «مكتب الناظر» for a student: his face in today's mood with his line, then his notes — the
 * attendance standing, any overdue bill, runs of absence, the next sessions — from data the
 * home already fetches. A FlatList (no ScrollView + map: that count may only shrink).
 */
export default function StudentNazerOffice() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useDialogPersona('nazer');
  const { data: stats } = useCoverageStats();
  const { data: risks } = useStudentAttendanceRisk();
  const { data: billing } = useStudentBillingStatus();
  const { data: today } = useTodaySessions();
  const { data: upcoming } = useUpcomingSessions(3);

  const total = stats?.total ?? 0;
  const list = today ?? [];
  const nowMs = Date.now();
  const live = list.find((s) => s.status === 'live');
  const nextToday = list.find((s) => s.status === 'scheduled' && new Date(s.scheduled_at).getTime() >= nowMs);
  const say = studentSay({
    billing: billing ?? [],
    risks: risks ?? [],
    coverage: { present: stats?.present ?? 0, late: stats?.late ?? 0, absent: stats?.absent ?? 0, total },
    live: live ? { course_name: live.course_name, checked_in: !!live.checked_in || !!live.attendance_status } : null,
    next: nextToday ? { course_name: nextToday.course_name, scheduled_at: nextToday.scheduled_at } : null,
  }, (key, opts) => String(t(key, opts)));

  const notes: Note[] = [];
  if (total > 0) {
    const rate = Math.round((((stats?.present ?? 0) + (stats?.late ?? 0)) / total) * 100);
    notes.push({ id: 'attendance', icon: 'attendance', tone: rate >= 90 ? 'success' : rate >= 75 ? 'info' : 'warning', title: t('nazer.note_attendance_me', { rate, absent: stats?.absent ?? 0, total }), route: '/(student)/attendance' as Href });
  }
  for (const b of billing ?? []) {
    notes.push({ id: `due-${b.teacher_name ?? ''}-${b.amount}`, icon: 'money', tone: b.blocking ? 'danger' : 'warning', title: t('nazer.note_due_me', { amount: formatEGP(b.amount), teacher: b.teacher_name ?? '' }), route: '/(student)/(tabs)/invoices' as Href });
  }
  for (const r of risks ?? []) {
    notes.push({ id: `risk-${r.course_name ?? ''}`, icon: 'absent', tone: 'warning', title: t('nazer.note_absences_me', { count: r.absences, course: r.course_name ?? '' }), route: '/(student)/attendance' as Href });
  }
  for (const s of (upcoming ?? []).slice(0, 3)) {
    notes.push({ id: `next-${s.id}`, icon: 'sessions', tone: 'info', title: t('nazer.note_next', { course: s.course_name ?? '', when: `${formatDayDate(s.scheduled_at)} ${formatTime(s.scheduled_at)}` }), route: '/(student)/(tabs)/check-in' as Href });
  }
  if (notes.length === 0) notes.push({ id: 'empty', icon: 'success', tone: 'success', title: t('nazer.note_empty') });

  return (
    <Surface id="screen.student.nazer" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        initialNumToRender={10}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: nav.pageEnd + insets.bottom }}
        ListHeaderComponent={
          <View>
            <Surface id="student.nazer.hero">
            <PageHero title={t('nazer.office_title')} subtitle={t('nazer.subtitle')} onBack>
              <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                <View>
                  <NazerFace mood={say.mood} size={150} />
                  {say.stamp ? <NazerStamp kind={say.stamp} size={64} style={{ position: 'absolute', bottom: -4, end: -16 }} /> : null}
                </View>
                <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, maxWidth: 340, ...shadows.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 26, color: colors.textPrimary, textAlign: 'center' }}>{say.line}</Text>
                  {say.route ? (
                    <TouchableOpacity onPress={() => router.push(say.route as Href)} accessibilityRole="button" activeOpacity={0.8} style={{ marginTop: spacing.sm, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{say.routeLabel}</Text>
                      <Icon name="back" size={14} color={colors.brand} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </PageHero>
            </Surface>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('nazer.notes_title')}</Text>
          </View>
        }
        renderItem={({ item }) => <NoteRow note={item} />}
        ListFooterComponent={
          <Surface id="student.nazer.footer">
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: '#1B2A5E', borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <NazerFace mood="neutral" size={48} blink={false} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#F6EFE0' }}>{t('nazer.office_close')}</Text>
              <TouchableOpacity onPress={() => router.push('/(student)/support' as Href)} accessibilityRole="button" activeOpacity={0.8} style={{ marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: '#C9A227', borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#1B2A5E' }}>{t('nazer.write_teacher')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </Surface>
        }
      />
    </View>
    </Surface>
  );
}

function NoteRow({ note }: { note: Note }) {
  const tone = TONES()[note.tone];
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderStartWidth: 4, borderStartColor: tone.fg }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={note.icon} size={20} color={tone.fg} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.textPrimary }}>{note.title}</Text>
      {note.route ? <Icon name="back" size={16} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!note.route) return body;
  return <TouchableOpacity onPress={() => router.push(note.route as Href)} activeOpacity={0.8} accessibilityRole="button">{body}</TouchableOpacity>;
}
