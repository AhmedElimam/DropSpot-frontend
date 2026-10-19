import { memo, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { REVISION_INK } from '@/theme/revision';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Surface } from '@/ui/surfaces';
import { useRevisions } from '@/hooks/useRevisions';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { formatNumber, formatDate, formatTime } from '@/utils/format';
import { dayKey } from '@/utils/sessionDays';
import { arabicCountForm, countdown, countdownBlock, nextExam, nextSlot, revisionFacts, revisionToCard, revisionsOnDay, splitRevisionTitle, type NextExam, type RevisionCardData } from '@/utils/revisionDesk';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { SessionCard } from '@/components/session/TeacherSessionCard';
import { GuestPassModal } from '@/components/teacher/GuestPassModal';
import type { RevisionSummary } from '@/api/revisions';

/**
 * The revision desk (founder 2026-10-16: «allowing revision tools to be prioritised»; reworked
 * 10-17: «I don't like the positioning … the revision tools set-up or design … more love»).
 * While «وضع المراجعة» is on, Home reads top to bottom as one season:
 *
 *   the hero      the switch chip beside the logo (RevisionSwitch), then the next exam's
 *                 countdown on indigo glass with the season in numbers (SeasonCountdown)
 *   the desk      today's revision / exam sessions, when there are any, then the tool kit:
 *                 two large tiles (the kiosk, pointed at the next slot; a new session) and
 *                 four small ones (a new exam, marks, guest passes, merging groups)
 *   «يومك المعتاد» everything Home had before, untouched
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

const GLASS = 'rgba(255,255,255,0.07)';
const HAIR = 'rgba(255,255,255,0.12)';

/**
 * The countdown, IN the hero (founder 2026-10-17: «I don't like the positioning of revision
 * mode»). The first cut put it in a white card under the band, after a switch pill wedged
 * between the connection line and the stats; now the season IS the hero: the next exam's
 * countdown on the indigo glass where the day's greeting sits, with the season in numbers on
 * its lower strip. One tap opens the revision sessions. Memoised: Home re-renders on focus.
 */
export const SeasonCountdown = memo(function SeasonCountdown({ now, next, loading, revisions }: { now: number; next: NextExam | null; loading: boolean; revisions: RevisionSummary[] }) {
  const { t } = useTranslation();
  const cd = next ? countdown(next.at, now) : null;
  const block = cd ? countdownBlock(cd) : null;
  const parts = next ? splitRevisionTitle(next.rev.title) : null;
  const facts = revisionFacts(revisions, now);
  const when = next ? formatDate(new Date(next.at), { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : null;
  return (
    <Surface id="teacher.home.revision_hero">
    <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(teacher)/revisions' as Href)} accessibilityRole="button"
      accessibilityLabel={next && cd ? `${t(next.kind === 'exam' ? 'revision.next_exam' : 'revision.next_revision')} ${countdownText(cd, t)} — ${next.rev.title}` : t('revision.no_next')}
      style={{ marginTop: spacing.lg, borderRadius: radius.xxl, backgroundColor: GLASS, borderWidth: 1, borderColor: 'rgba(242,166,90,0.34)', padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {/* How long is left: the amber number, the unit under it. */}
        <View style={{ width: 86, height: 86, borderRadius: 22, backgroundColor: 'rgba(8,10,28,0.38)', borderWidth: 1, borderColor: 'rgba(242,166,90,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          {loading && !next ? <ActivityIndicator color={REVISION_INK.amberGlow} /> : block ? (
            block.n == null ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: REVISION_INK.amberGlow }}>{t('revision.now')}</Text>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 13, color: 'rgba(255,255,255,0.62)' }}>{t('revision.left')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 34, lineHeight: 41, color: REVISION_INK.amberGlow }} numberOfLines={1} adjustsFontSizeToFit>{formatNumber(block.n)}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, color: '#FFFFFF' }} numberOfLines={1}>{t(block.unitKey)}</Text>
              </>
            )
          ) : (
            <Icon name="trophy" size={30} color={REVISION_INK.amberGlow} />
          )}
        </View>
        {/* What it counts down to — one idea per line. */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: REVISION_INK.amberGlow }} numberOfLines={1}>
            {next ? t(next.kind === 'exam' ? 'revision.next_exam' : 'revision.next_revision') : t('revision.season')}
          </Text>
          {next && parts ? (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: '#FFFFFF' }} numberOfLines={1}>{parts.name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.72)' }} numberOfLines={1}>{parts.subject ? `${parts.subject} | ${when}` : when}</Text>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, color: '#FFFFFF' }} numberOfLines={1}>{t(loading ? 'revision.feature_card_title' : 'revision.no_next')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.72)' }} numberOfLines={1}>{t('revision.no_next_sub')}</Text>
            </>
          )}
        </View>
        <Icon name="back" size={16} color="rgba(255,255,255,0.5)" />
      </View>
      {/* The season in numbers — facts the server already knows. */}
      <View style={{ flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: HAIR }}>
        {[
          { k: 'week', v: facts.thisWeek, l: t('revision.fact_week') },
          { k: 'exams', v: facts.examsAhead, l: t('revision.fact_exams_ahead') },
          { k: 'sessions', v: facts.sessionsAhead, l: t('revision.fact_sessions_ahead') },
        ].map((x, i) => (
          <View key={x.k} style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5, borderStartWidth: i === 0 ? 0 : 1, borderStartColor: HAIR }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: REVISION_INK.amberGlow }}>{formatNumber(x.v)}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.74)' }} numberOfLines={1}>{x.l}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
    </Surface>
  );
});

export function countdownText(cd: ReturnType<typeof countdown>, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (cd.key === 'revision.now') return t('revision.now');
  return t(`${cd.key}_${arabicCountForm(cd.n)}`, { n: formatNumber(cd.n) });
}

/**
 * The desk under the hero: today's revision / exam sessions (only when there are any — an
 * empty «nothing today» card only pushed the tools down), then the tool kit.
 */
export const RevisionDesk = memo(function RevisionDesk({ now, revisions, loading, canScan }: { now: number; revisions: RevisionSummary[]; loading: boolean; canScan: boolean }) {
  const { t } = useTranslation();
  const today = revisionsOnDay(revisions, dayKey(new Date(now)));
  const [guestFor, setGuestFor] = useState<RevisionCardData | null>(null);

  return (
    <Surface id="teacher.home.revision_desk">
    <View>
      {today.length > 0 ? (
        <Surface id="teacher.home.revision_today">
        <View style={{ marginBottom: spacing.lg }}>
          <DeskHead icon="calendar" title={t('revision.today_title')} action={t('home.all_sessions')} onAction={() => router.push('/(teacher)/revisions' as Href)} />
          {today.map((rev) => {
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
      ) : null}

      <RevisionToolkit now={now} revisions={revisions} loading={loading} />

      <Surface id="teacher.home.revision_guest_pass_modal"><GuestPassModal visible={!!guestFor} revisionId={guestFor?.revision_id ?? null} instanceId={guestFor?.instance_id ?? null} sessionTitle={guestFor?.course_name ?? undefined} onClose={() => setGuestFor(null)} /></Surface>
    </View>
    </Surface>
  );
});

/**
 * «أدوات المراجعة» — one kit, in the order a teacher reaches for things in the season
 * (founder 2026-10-17: «the revision tools set-up and design … we need more love»; the first
 * cut was six identical white tiles). Two large tiles first: the KIOSK, already pointed at the
 * next revision slot and saying which one, and a NEW revision session. Then four smaller
 * ones: a new exam, the marks (the nearest exam's), guest passes, merging groups. Each tile
 * says where it will take you, so nothing is a guess. Assistants see only what they may use.
 */
function RevisionToolkit({ now, revisions, loading }: { now: number; revisions: RevisionSummary[]; loading: boolean }) {
  const { t } = useTranslation();
  const slot = nextSlot(revisions, now);
  const exam = revisions
    .map((r) => ({ r, at: r.scheduled_at ? new Date(r.scheduled_at).getTime() : NaN }))
    .filter((x) => (x.r.is_quiz_exam || x.r.purpose === 'quiz_exam') && !Number.isNaN(x.at))
    .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))[0]?.r ?? null;
  const toList = () => router.push('/(teacher)/revisions' as Href);
  const slotHint = slot
    ? `${splitRevisionTitle(slot.rev.title).subject ?? splitRevisionTitle(slot.rev.title).name} | ${dayKey(new Date(slot.at)) === dayKey(new Date(now)) ? formatTime(new Date(slot.at)) : formatDate(new Date(slot.at), { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`
    : t(loading ? 'revision.feature_card_sub' : 'revision.tool_kiosk_none');

  const big: { key: string; icon: IconName; label: string; hint: string; fill: readonly [string, string]; assistantNeeds: string; onPress: () => void }[] = [
    { key: 'kiosk', icon: 'scan', label: t('revision.tool_kiosk'), hint: slotHint, fill: ['#2E3990', REVISION_INK.indigoDeep], assistantNeeds: 'teacher', onPress: () => (slot ? goToRevisionScan(slot.rev) : toList()) },
    { key: 'new_revision', icon: 'add', label: t('revision.tool_new_revision'), hint: t('revision.tool_new_revision_hint'), fill: [REVISION_INK.amberGlow, REVISION_INK.amberDeep], assistantNeeds: 'teacher', onPress: () => router.push('/(teacher)/revision-create' as Href) },
  ];
  const small: { key: string; icon: IconName; label: string; color: string; assistantNeeds: string; onPress: () => void }[] = [
    { key: 'new_exam', icon: 'trophy', label: t('revision.tool_new_exam'), color: REVISION_INK.amber, assistantNeeds: 'teacher', onPress: () => router.push('/(teacher)/revision-create?purpose=quiz_exam' as Href) },
    { key: 'marks', icon: 'grades', label: t('revision.tool_marks'), color: colors.primary, assistantNeeds: 'teacher', onPress: () => (exam ? goToRevisionMarks(exam) : toList()) },
    { key: 'guest_passes', icon: 'card', label: t('revision.tool_guest_passes'), color: colors.success, assistantNeeds: 'issue_guest_passes', onPress: toList },
    { key: 'merge', icon: 'transfer', label: t('revision.tool_merge'), color: colors.info, assistantNeeds: 'manage_courses', onPress: () => router.push('/(teacher)/schedule-merge' as Href) },
  ];

  return (
    <Surface id="teacher.home.revision_tools">
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadows.md }}>
      <DeskHead icon="book" title={t('revision.tools_title')} sub={t('revision.tools_sub')} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {big.map((x) => (
          <Surface key={x.key} id={`teacher.home.revision_tool_${x.key}`} assistantNeeds={x.assistantNeeds}>
          <TouchableOpacity onPress={x.onPress} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={`${x.label} — ${x.hint}`} style={{ flex: 1 }}>
            <LinearGradient colors={[...x.fill]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 112, borderRadius: radius.xl, padding: spacing.md, justifyContent: 'space-between', overflow: 'hidden' }}>
              {/* A faint glyph in the far corner (away from the words): the tile's own watermark. */}
              <View pointerEvents="none" style={{ position: 'absolute', top: -8, end: -8, opacity: 0.09 }}><Icon name={x.icon} size={64} color="#FFFFFF" /></View>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={x.icon} size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: '#FFFFFF' }} numberOfLines={1}>{x.label}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 16, color: 'rgba(255,255,255,0.82)' }} numberOfLines={1}>{x.hint}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          </Surface>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        {small.map((x) => (
          <Surface key={x.key} id={`teacher.home.revision_tool_${x.key}`} assistantNeeds={x.assistantNeeds}>
          <TouchableOpacity onPress={x.onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={x.label}
            style={{ flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: 4, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: x.color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={x.icon} size={19} color={x.color} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 15, color: colors.textPrimary, textAlign: 'center' }} numberOfLines={2}>{x.label}</Text>
          </TouchableOpacity>
          </Surface>
        ))}
      </View>
    </View>
    </Surface>
  );
}

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

function DeskHead({ icon, title, sub, action, onAction }: { icon: IconName; title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: REVISION_INK.amber + '24', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={REVISION_INK.amberDeep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.textPrimary }}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{action}</Text></TouchableOpacity>
      ) : null}
    </View>
  );
}

/** «يومك المعتاد» — the quiet divider above everything Home had before the season. */
export function UsualDayHead({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Surface id="teacher.home.usual_day_head">
    <View style={{ marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Icon name="home" size={13} color={colors.textSecondary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary }}>{t('revision.usual_day')}</Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      {children}
    </View>
    </Surface>
  );
}
