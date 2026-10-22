import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionHead } from '@/components/ui/SectionHead';
import { Surface } from '@/ui/surfaces';
import { useDialogPersona } from '@/ui/dialog';
import { NazerHero } from '@/components/nazer/NazerHero';
import { NazerFace } from '@/components/nazer/NazerFace';
import { NazerStamp, type NazerStampKind } from '@/components/nazer/NazerStamp';
import { parentSay } from '@/nazer/mood';
import { useChildren } from '@/hooks/useChildren';
import { useParentAttendanceRisk } from '@/hooks/useAttendance';
import { useParentBillingStatus } from '@/hooks/useInvoices';
import { useNotifications } from '@/hooks/useNotifications';
import { useTickets } from '@/hooks/useTickets';
import { useSessionNotes } from '@/hooks/useSessionNotes';
import { latestNotes } from '@/nazer/notes';
import { NazerReportsCard } from '@/components/nazer/NazerReportsCard';
import { getChildReportUrl, getMyReportUrl } from '@/api/nazerReport';
import { formatEGP } from '@/utils/currency';
import { formatNumber } from '@/utils/format';

type Tone = 'success' | 'warning' | 'danger' | 'info';
interface Note { id: string; icon: IconName; tone: Tone; title: string; sub?: string; stamp?: NazerStampKind; route?: Href }

const TONES = (): Record<Tone, { bg: string; fg: string }> => ({
  success: { bg: colors.successLight, fg: colors.success },
  warning: { bg: colors.warningLight, fg: colors.warningDark },
  danger: { bg: colors.dangerLight, fg: colors.danger },
  info: { bg: colors.brandTint, fg: colors.brand },
});

/**
 * «مكتب الناظر» for a parent, laid out like مدام روز's desk: the navy band with his face,
 * his typed line and the day's facts as chips; then his notes — one per child's standing,
 * each overdue bill, each run of absences, the open tickets — stamped where the matter is
 * formal. All from data the home already fetches; a FlatList (no ScrollView + map).
 */
export default function ParentNazerOffice() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useDialogPersona('nazer');
  const { data: children } = useChildren();
  const { data: risks } = useParentAttendanceRisk();
  const { data: billing } = useParentBillingStatus();
  const { data: notifications } = useNotifications();
  const { data: tickets } = useTickets();
  const { data: notesPages } = useSessionNotes('parent');
  const recentNotes = latestNotes(notesPages?.pages[0]?.items ?? []);

  const kids = children ?? [];
  const say = parentSay({
    children: kids.map((c) => ({ name: c.name, student_id: c.student_id, attendance_rate: c.attendance_rate ?? 0, present_count: c.present_count ?? 0, absent_count: c.absent_count ?? 0 })),
    billing: billing ?? [],
    risks: risks ?? [],
    latestNotification: (notifications ?? [])[0] ?? null,
    freshNote: recentNotes.latest,
  }, (key, opts) => String(t(key, opts)));

  const open = (tickets ?? []).filter((x) => x.status === 'open' || x.status === 'in_progress').length;
  const dueTotal = (billing ?? []).reduce((a, b) => a + b.amount, 0);
  const lines: string[] = [];
  if (kids.length) lines.push(t('nazer.chip_children', { count: formatNumber(kids.length) }));
  if (dueTotal > 0) lines.push(t('nazer.chip_due', { amount: formatEGP(dueTotal) }));
  if (risks?.length) lines.push(t('nazer.chip_absent', { count: formatNumber(risks.reduce((a, r) => a + r.absences, 0)) }));
  if (open) lines.push(t('nazer.chip_tickets', { count: formatNumber(open) }));
  if (recentNotes.fresh) lines.push(t('nazer.chip_new_notes', { count: formatNumber(recentNotes.fresh) }));

  const notes: Note[] = [];
  for (const c of kids) {
    const rate = Math.round(c.attendance_rate ?? 0);
    const settled = (c.present_count ?? 0) + (c.absent_count ?? 0) >= 4;
    notes.push({ id: `child-${c.id}`, icon: 'child', tone: rate >= 90 ? 'success' : rate >= 75 ? 'info' : 'warning', title: c.name, sub: t('nazer.note_standing', { rate, absent: c.absent_count ?? 0 }), stamp: settled && rate >= 90 ? 'approved' : undefined, route: `/(parent)/child/${c.student_id}` as Href });
  }
  for (const b of billing ?? []) {
    notes.push({ id: `due-${b.student_id}`, icon: 'money', tone: b.blocking ? 'danger' : 'warning', title: t('nazer.note_due', { name: b.student_name ?? '', amount: formatEGP(b.amount), teacher: b.teacher_name ?? '' }), stamp: b.blocking ? 'notice' : undefined, route: '/(parent)/(tabs)/invoices' as Href });
  }
  for (const r of risks ?? []) {
    notes.push({ id: `risk-${r.student_id}-${r.course_name ?? ''}`, icon: 'absent', tone: 'warning', title: t('nazer.note_absences', { name: r.student_name ?? '', count: r.absences, course: r.course_name ?? '' }), stamp: r.absences >= 3 ? 'notice' : undefined, route: `/(parent)/child/${r.student_id}` as Href });
  }
  // What the teachers wrote after the sessions, newest three; the rest in «ملاحظات الحصص».
  for (const e of recentNotes.top) {
    notes.push({ id: `notes-${e.id}`, icon: 'book', tone: 'info', title: t('nazer.note_latest_title', { course: e.course_name ?? '', teacher: e.teacher_name ?? '' }), sub: e.summary ?? e.note ?? undefined, route: `/(parent)/session-notes?student_id=${e.student_id}` as Href });
  }
  if (open) notes.push({ id: 'tickets', icon: 'tickets', tone: 'info', title: t('nazer.note_tickets', { count: open }), route: '/(parent)/tickets' as Href });
  if (notes.length === 0) notes.push({ id: 'empty', icon: 'success', tone: 'success', title: t('nazer.note_empty') });

  return (
    <Surface id="screen.parent.nazer" screen>
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
            <Surface id="parent.nazer.hero"><NazerHero say={say} lines={lines} onBack={() => (router.canGoBack() ? router.back() : router.replace('/(parent)/(tabs)' as Href))} /></Surface>
            <Surface id="parent.nazer.reports"><NazerReportsCard items={kids.map((c) => ({ key: String(c.student_id), name: c.name, url: () => getChildReportUrl(c.student_id) }))} /></Surface>
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <SectionHead icon="note" color={colors.accent} title={t('nazer.notes_title')} />
            </View>
          </View>
        }
        renderItem={({ item }) => <NoteRow note={item} />}
        ListFooterComponent={
          <Surface id="parent.nazer.footer">
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.sm }}>
            <NazerFace mood="neutral" size={56} blink={false} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{t('nazer.office_close')}</Text>
              <TouchableOpacity onPress={() => router.push('/(parent)/tickets' as Href)} accessibilityRole="button" activeOpacity={0.8} style={{ marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: colors.brand, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onPrimary }}>{t('nazer.write_teacher')}</Text>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, ...shadows.sm }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={note.icon} size={20} color={tone.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 21, color: colors.textPrimary }}>{note.title}</Text>
        {note.sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: 1 }}>{note.sub}</Text> : null}
      </View>
      {note.stamp ? <NazerStamp kind={note.stamp} size={40} style={{ marginEnd: 2 }} /> : note.route ? <Icon name="back" size={16} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!note.route) return body;
  return <TouchableOpacity onPress={() => router.push(note.route as Href)} activeOpacity={0.8} accessibilityRole="button">{body}</TouchableOpacity>;
}
