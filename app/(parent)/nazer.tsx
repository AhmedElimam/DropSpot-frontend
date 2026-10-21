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
import { parentSay } from '@/nazer/mood';
import { useChildren } from '@/hooks/useChildren';
import { useParentAttendanceRisk } from '@/hooks/useAttendance';
import { useParentBillingStatus } from '@/hooks/useInvoices';
import { useNotifications } from '@/hooks/useNotifications';
import { useTickets } from '@/hooks/useTickets';
import { formatEGP } from '@/utils/currency';

type Tone = 'success' | 'warning' | 'danger' | 'info';
interface Note { id: string; icon: IconName; tone: Tone; title: string; body?: string; route?: Href }

const TONES = (): Record<Tone, { bg: string; fg: string }> => ({
  success: { bg: colors.successLight, fg: colors.success },
  warning: { bg: colors.warningLight, fg: colors.warningDark },
  danger: { bg: colors.dangerLight, fg: colors.danger },
  info: { bg: colors.brandTint, fg: colors.brand },
});

/**
 * «مكتب الناظر» for a parent: his face in today's mood with his line, then his notes — one per
 * child's standing, each overdue bill, each run of absences, the open tickets — all from
 * data the home already fetches. A FlatList (no ScrollView + map: that count may only shrink).
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

  const kids = children ?? [];
  const say = parentSay({
    children: kids.map((c) => ({ name: c.name, student_id: c.student_id, attendance_rate: c.attendance_rate ?? 0, present_count: c.present_count ?? 0, absent_count: c.absent_count ?? 0 })),
    billing: billing ?? [],
    risks: risks ?? [],
    latestNotification: (notifications ?? [])[0] ?? null,
  }, (key, opts) => String(t(key, opts)));

  const notes: Note[] = [];
  for (const c of kids) {
    const rate = Math.round(c.attendance_rate ?? 0);
    notes.push({ id: `child-${c.id}`, icon: 'child', tone: rate >= 90 ? 'success' : rate >= 75 ? 'info' : 'warning', title: t('nazer.note_attendance', { name: c.name, rate, absent: c.absent_count ?? 0 }), route: `/(parent)/child/${c.student_id}` as Href });
  }
  for (const b of billing ?? []) {
    notes.push({ id: `due-${b.student_id}`, icon: 'money', tone: b.blocking ? 'danger' : 'warning', title: t('nazer.note_due', { name: b.student_name ?? '', amount: formatEGP(b.amount), teacher: b.teacher_name ?? '' }), route: '/(parent)/(tabs)/invoices' as Href });
  }
  for (const r of risks ?? []) {
    notes.push({ id: `risk-${r.student_id}-${r.course_name ?? ''}`, icon: 'absent', tone: 'warning', title: t('nazer.note_absences', { name: r.student_name ?? '', count: r.absences, course: r.course_name ?? '' }), route: `/(parent)/child/${r.student_id}` as Href });
  }
  const open = (tickets ?? []).filter((x) => x.status === 'open' || x.status === 'in_progress').length;
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
            <Surface id="parent.nazer.hero">
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
          <Surface id="parent.nazer.footer">
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: '#1B2A5E', borderRadius: radius.xxl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <NazerFace mood="neutral" size={48} blink={false} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#F6EFE0' }}>{t('nazer.office_close')}</Text>
              <TouchableOpacity onPress={() => router.push('/(parent)/tickets' as Href)} accessibilityRole="button" activeOpacity={0.8} style={{ marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: '#C9A227', borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: spacing.md }}>
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
