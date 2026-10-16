import { memo, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { REVISION_INK } from '@/theme/revision';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Surface } from '@/ui/surfaces';
import { useRevisions } from '@/hooks/useRevisions';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { formatNumber, formatDate } from '@/utils/format';
import { dayKey } from '@/utils/sessionDays';
import { arabicCountForm, countdown, countdownBlock, nextExam, revisionFacts, revisionToCard, revisionsOnDay, splitRevisionTitle, type NextExam, type RevisionCardData } from '@/utils/revisionDesk';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { SessionCard } from '@/components/session/TeacherSessionCard';
import { GuestPassModal } from '@/components/teacher/GuestPassModal';
import type { RevisionSummary } from '@/api/revisions';

/**
 * The revision desk (founder 2026-10-16: «allowing revision tools to be prioritised»). While
 * «وضع المراجعة» is on, Home opens on it: the season's name and the next exam's countdown in
 * the hero, today's revision / exam sessions first, the six tools in the order a teacher
 * reaches for them before an exam, then the season in numbers. Everything Home had before
 * stays, below, under «يومك المعتاد».
 *
 * Only what the server offers is shown: `/revisions` (each active session with its nearest
 * slot and purpose). Absences in revision sessions and unpaid revision fees have no endpoint
 * yet, so there is no «students worth attention» block — nothing invented.
 */

// ── navigation into the revision engine ──
export function goToRevisionScan(rev: Pick<RevisionSummary, 'id' | 'instance_id' | 'title' | 'billing_mode'>): void {
  if (rev.instance_id == null) { router.push('/(teacher)/revisions' as Href); return; }
  router.push({ pathname: '/(teacher)/scan', params: { revisionId: String(rev.id), revisionInstanceId: String(rev.instance_id), revisionTitle: rev.title, billingMode: rev.billing_mode } });
}
export function goToRevisionMarks(rev: Pick<RevisionSummary, 'id' | 'instance_id' | 'title' | 'max_mark'>): void {
  if (rev.instance_id == null) { router.push('/(teacher)/revisions' as Href); return; }
  router.push({ pathname: '/(teacher)/revision-marks', params: { revisionId: String(rev.id), instanceId: String(rev.instance_id), title: rev.title, maxMark: rev.max_mark != null ? String(rev.max_mark) : '' } });
}

/** «الامتحان القادم بعد ٣ أيام» — the hero's season line. */
export function useNextExam(now: number, enabled = true): { next: NextExam | null; loading: boolean; revisions: RevisionSummary[] } {
  const q = useRevisions(enabled);
  // Stable while the data and the minute hold, so the memoised desk skips a focus re-render.
  const revisions = q.data ?? NO_REVISIONS;
  const next = useMemo(() => nextExam(revisions, now), [revisions, now]);
  return { next, loading: q.isLoading, revisions };
}
const NO_REVISIONS: RevisionSummary[] = [];

// Memoised, like the desk below: Home re-renders on every focus, these only when their inputs move.
export const RevisionHeroLine = memo(function RevisionHeroLine({ now, next, loading }: { now: number; next: NextExam | null; loading: boolean }) {
  const { t } = useTranslation();
  const cd = next ? countdown(next.at, now) : null;
  // A card, like the spotlight it replaces at the top of the page: it overlaps the hero's
  // lower edge, so it is a surface with its own ink, not text on the band.
  return (
    <Surface id="teacher.home.revision_hero">
    <View style={{ borderRadius: radius.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: REVISION_INK.amber, paddingVertical: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.md }}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: REVISION_INK.indigo, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={next?.kind === 'revision' ? 'book' : 'trophy'} size={24} color={REVISION_INK.amber} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: REVISION_INK.amberDeep }}>{t('revision.season')}</Text>
        {loading && !next ? <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginTop: 4 }} /> : next && cd ? (
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 25, color: colors.textPrimary }} numberOfLines={1}>
            {t(next.kind === 'exam' ? 'revision.next_exam' : 'revision.next_revision')} {countdownText(cd, t)}
          </Text>
        ) : (
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23, color: colors.textPrimary }}>{t('revision.no_next')}</Text>
        )}
        {next ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{next.rev.title} | {formatDate(new Date(next.at), { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</Text>
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{t('revision.no_next_sub')}</Text>
        )}
      </View>
    </View>
    </Surface>
  );
});

export function countdownText(cd: ReturnType<typeof countdown>, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (cd.key === 'revision.now') return t('revision.now');
  return t(`${cd.key}_${arabicCountForm(cd.n)}`, { n: formatNumber(cd.n) });
}

/** The desk itself — under the hero, above everything Home had before. */
export const RevisionDesk = memo(function RevisionDesk({ now, revisions, loading, canScan }: { now: number; revisions: RevisionSummary[]; loading: boolean; canScan: boolean }) {
  const { t } = useTranslation();
  const { can, isAssistant } = useActiveAbilities();
  const today = revisionsOnDay(revisions, dayKey(new Date(now)));
  const next = nextExam(revisions, now);
  const nextExamOnly = revisions.map((r) => ({ r, at: r.scheduled_at ? new Date(r.scheduled_at).getTime() : NaN })).filter((x) => (x.r.is_quiz_exam || x.r.purpose === 'quiz_exam') && !Number.isNaN(x.at)).sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))[0]?.r ?? null;
  const facts = revisionFacts(revisions, now);
  const [guestFor, setGuestFor] = useState<RevisionCardData | null>(null);

  const tools: { key: string; icon: IconName; label: string; tint: string; assistantNeeds?: string; onPress: () => void }[] = [
    { key: 'new_revision', icon: 'add', label: t('revision.tool_new_revision'), tint: REVISION_INK.indigo, assistantNeeds: 'teacher', onPress: () => router.push('/(teacher)/revision-create' as Href) },
    { key: 'new_exam', icon: 'trophy', label: t('revision.tool_new_exam'), tint: REVISION_INK.amber, assistantNeeds: 'teacher', onPress: () => router.push('/(teacher)/revision-create?purpose=quiz_exam' as Href) },
    { key: 'guest_passes', icon: 'card', label: t('revision.tool_guest_passes'), tint: colors.success, assistantNeeds: 'issue_guest_passes', onPress: () => router.push('/(teacher)/revisions' as Href) },
    { key: 'kiosk', icon: 'scan', label: t('revision.tool_kiosk'), tint: REVISION_INK.indigo, assistantNeeds: 'teacher', onPress: () => (next ? goToRevisionScan(next.rev) : router.push('/(teacher)/revisions' as Href)) },
    { key: 'marks', icon: 'grades', label: t('revision.tool_marks'), tint: REVISION_INK.amber, assistantNeeds: 'teacher', onPress: () => (nextExamOnly ? goToRevisionMarks(nextExamOnly) : router.push('/(teacher)/revisions' as Href)) },
    { key: 'merge', icon: 'transfer', label: t('revision.tool_merge'), tint: colors.info, assistantNeeds: 'manage_courses', onPress: () => router.push('/(teacher)/schedule-merge' as Href) },
  ];
  void can; void isAssistant;

  return (
    <Surface id="teacher.home.revision_desk">
    <View>
      {/* Today's revision / exam sessions — the day's first cards. */}
      <Surface id="teacher.home.revision_today">
      <View style={{ marginTop: spacing.lg }}>
        <DeskHead icon="calendar" color={REVISION_INK.indigo} title={t('revision.today_title')} action={t('home.all_sessions')} onAction={() => router.push('/(teacher)/revisions' as Href)} />
        {loading && revisions.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}><ActivityIndicator color={colors.primary} /></View>
        ) : today.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderStartWidth: 5, borderStartColor: REVISION_INK.indigo }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: REVISION_INK.light, alignItems: 'center', justifyContent: 'center' }}><Icon name="book" size={20} color={REVISION_INK.indigo} /></View>
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('revision.today_empty')}</Text>
          </View>
        ) : today.map((rev) => {
          const card = revisionToCard(rev);
          return (
            <View key={card.id}>
              <SessionCard s={card} now={now} onOpen={() => router.push('/(teacher)/revisions' as Href)} onScan={canScan && rev.instance_id != null ? () => goToRevisionScan(rev) : undefined} />
              <RevisionCardActions rev={rev} onGuest={() => setGuestFor(card)} />
            </View>
          );
        })}
      </View>
      </Surface>

      {/* The tools, in the order a teacher reaches for them before an exam. */}
      <Surface id="teacher.home.revision_tools">
      <View style={{ marginTop: spacing.xl }}>
        <DeskHead icon="book" color={REVISION_INK.amber} title={t('revision.tools_title')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {tools.map((x) => (
            <Surface key={x.key} id={`teacher.home.revision_tool_${x.key}`} assistantNeeds={x.assistantNeeds}>
            <TouchableOpacity onPress={x.onPress} activeOpacity={0.85} accessibilityRole="button"
              style={{ width: '31.5%', minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, paddingHorizontal: 6, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: x.tint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={x.icon} size={22} color="#FFFFFF" />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.textPrimary, textAlign: 'center' }} numberOfLines={2}>{x.label}</Text>
            </TouchableOpacity>
            </Surface>
          ))}
        </View>
      </View>
      </Surface>

      {/* The season in numbers — facts the server already knows. */}
      <Surface id="teacher.home.revision_facts">
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        {[
          { k: 'week', v: facts.thisWeek, l: t('revision.fact_week') },
          { k: 'exams', v: facts.examsAhead, l: t('revision.fact_exams_ahead') },
          { k: 'sessions', v: facts.sessionsAhead, l: t('revision.fact_sessions_ahead') },
        ].map((x) => (
          <View key={x.k} style={{ flex: 1, backgroundColor: REVISION_INK.light, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: 'rgba(35,44,107,0.14)' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: REVISION_INK.indigo }}>{formatNumber(x.v)}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: REVISION_INK.onLight }} numberOfLines={1}>{x.l}</Text>
          </View>
        ))}
      </View>
      </Surface>

      <Surface id="teacher.home.revision_guest_pass_modal"><GuestPassModal visible={!!guestFor} revisionId={guestFor?.revision_id ?? null} instanceId={guestFor?.instance_id ?? null} sessionTitle={guestFor?.course_name ?? undefined} onClose={() => setGuestFor(null)} /></Surface>
    </View>
    </Surface>
  );
});

/** Under a revision card: guest pass (teacher / abled assistant) and, for an exam, the marks. */
export function RevisionCardActions({ rev, onGuest }: { rev: RevisionSummary; onGuest: () => void }) {
  const { t } = useTranslation();
  const { can } = useActiveAbilities();
  if (rev.instance_id == null) return null;
  const exam = rev.is_quiz_exam || rev.purpose === 'quiz_exam';
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: -2, marginBottom: spacing.sm }}>
      {can(ABILITY.ISSUE_GUEST_PASSES) ? (
        <Surface id="teacher.revision_card.guest_button" assistantNeeds="issue_guest_passes">
        <TouchableOpacity onPress={onGuest} accessibilityRole="button" accessibilityLabel={t('teacher.guest_pass_issue')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: radius.md, backgroundColor: REVISION_INK.light }}>
          <Icon name="add" size={15} color={REVISION_INK.indigo} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: REVISION_INK.indigo }}>{t('revision.guest')}</Text>
        </TouchableOpacity>
        </Surface>
      ) : null}
      {exam ? (
        <Surface id="teacher.revision_card.marks_button" assistantNeeds="teacher">
        <TouchableOpacity onPress={() => goToRevisionMarks(rev)} accessibilityRole="button"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: radius.md, backgroundColor: colors.accentLight }}>
          <Icon name="grades" size={15} color={colors.accentText} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.accentText }}>{t('revision.marks')}</Text>
        </TouchableOpacity>
        </Surface>
      ) : null}
    </View>
  );
}

/**
 * The manage hub's featured card while the season is on (founder 2026-10-16: «not really good
 * on the first banner»). The countdown is the hero — one amber number and its unit in a
 * rounded block at the start — then what it counts down to (title, the exam's name, its
 * subject, each on its own line), then three equal ways in. No corner ribbon: the indigo ink
 * and the amber number already say «season». Owns its minute clock, so the manage screen
 * itself never re-renders on a tick or a tab switch.
 */
export function RevisionFeatureCard() {
  const { t } = useTranslation();
  const now = useMinuteClock();
  const { next, loading, revisions } = useNextExam(now);
  const cd = next ? countdown(next.at, now) : null;
  const block = cd ? countdownBlock(cd) : null;
  const exam = revisions.filter((r) => r.is_quiz_exam || r.purpose === 'quiz_exam')[0] ?? null;
  const parts = next ? splitRevisionTitle(next.rev.title) : null;
  const mini = (icon: IconName, label: string, onPress: () => void, surface: string, assistantNeeds?: string) => (
    <Surface id={surface} assistantNeeds={assistantNeeds}>
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, paddingHorizontal: 6, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
      <Icon name={icon} size={16} color={REVISION_INK.amber} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#FFFFFF' }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
    </Surface>
  );
  return (
    <Surface id="teacher.manage.revision_feature_card">
    <TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/(teacher)/revisions' as Href)} accessibilityRole="button" style={{ marginBottom: spacing.md }}>
      <LinearGradient colors={[REVISION_INK.indigo, REVISION_INK.indigoDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.md, ...shadows.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: spacing.md }}>
          {/* The hero: how long is left, big and amber. */}
          <View style={{ width: 92, minHeight: 92, borderRadius: radius.lg, backgroundColor: REVISION_INK.indigoDeeper, borderWidth: 1, borderColor: 'rgba(231,145,58,0.45)', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm }}>
            {loading && !next ? <ActivityIndicator color={REVISION_INK.amber} /> : block ? (
              block.n == null ? (
                <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: REVISION_INK.amber }}>{t('revision.now')}</Text>
              ) : (
                <>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: 'rgba(255,255,255,0.65)' }}>{t('revision.left')}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 36, lineHeight: 44, color: REVISION_INK.amber }} numberOfLines={1} adjustsFontSizeToFit>{formatNumber(block.n)}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: '#FFFFFF' }} numberOfLines={1}>{t(block.unitKey)}</Text>
                </>
              )
            ) : (
              <Icon name="trophy" size={30} color={REVISION_INK.amber} />
            )}
          </View>
          {/* What it counts down to — one idea per line, nothing wraps. */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: REVISION_INK.amber }} numberOfLines={1}>{t('revision.season')}</Text>
            {next && parts ? (
              <>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23, color: '#FFFFFF', marginTop: 2 }} numberOfLines={1}>{t(next.kind === 'exam' ? 'revision.next_exam' : 'revision.next_revision')}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.92)' }} numberOfLines={1} ellipsizeMode="tail">{parts.name}</Text>
                {parts.subject ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.68)' }} numberOfLines={1}>{parts.subject}</Text> : null}
              </>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 23, color: '#FFFFFF', marginTop: 2 }} numberOfLines={1}>{t(loading ? 'revision.feature_card_title' : 'revision.feature_none_title')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.68)' }} numberOfLines={1}>{t(loading ? 'revision.feature_card_sub' : 'revision.feature_none_sub')}</Text>
              </>
            )}
          </View>
          <View style={{ justifyContent: 'center' }}><Icon name="back" size={18} color="rgba(255,255,255,0.55)" /></View>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: spacing.md }} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {mini('scan', t('revision.scan_into'), () => (next ? goToRevisionScan(next.rev) : router.push('/(teacher)/revisions' as Href)), 'teacher.manage.revision_feature_scan', 'teacher')}
          {mini('card', t('revision.tool_guest_passes'), () => router.push('/(teacher)/revisions' as Href), 'teacher.manage.revision_feature_guests', 'issue_guest_passes')}
          {mini('grades', t('revision.marks'), () => (exam ? goToRevisionMarks(exam) : router.push('/(teacher)/revisions' as Href)), 'teacher.manage.revision_feature_marks', 'teacher')}
        </View>
      </LinearGradient>
    </TouchableOpacity>
    </Surface>
  );
}

function DeskHead({ icon, color, title, action, onAction }: { icon: IconName; color: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={15} color={color} />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{action}</Text></TouchableOpacity>
      ) : null}
    </View>
  );
}

/** «يومك المعتاد» — the divider above everything Home had before the season. */
export function UsualDayHead({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Surface id="teacher.home.usual_day_head">
    <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('revision.usual_day')}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, textAlign: 'center', marginTop: 2 }}>{t('revision.usual_day_sub')}</Text>
      {children}
    </View>
    </Surface>
  );
}

// Keep the gradient import meaningful for future hero variants (the manage card uses the ink directly).
void gradients;
