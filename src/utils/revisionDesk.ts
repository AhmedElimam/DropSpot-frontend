import type { RevisionSummary } from '@/api/revisions';
import type { SessionCardData } from '@/components/session/TeacherSessionCard';
import { formatTime } from '@/utils/format';
import { dayKey, addDays, weekStart } from '@/utils/sessionDays';

/**
 * The revision desk's arithmetic (founder 2026-10-16): which exam is next and how far away,
 * which revision sessions are today's, how a mixed day sorts while the season is on. Pure —
 * every rule here has a test in src/utils/__tests__/revisionDesk.test.ts.
 *
 * What the server offers today: `/revisions` = each ACTIVE revision session with its nearest
 * slot (`scheduled_at`, may be past) and its purpose. The regular session feeds carry no
 * type yet, so an exam held on a weekly slot is recognised only when the row says
 * `type: 'quiz_exam'` / `is_exam` (the detail payload does; the lists are a backend need).
 */

export type DeskKind = 'revision' | 'exam';

export interface NextExam { rev: RevisionSummary; kind: DeskKind; at: number }

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const n = new Date(iso).getTime();
  return Number.isNaN(n) ? null : n;
};

export const kindOf = (rev: Pick<RevisionSummary, 'is_quiz_exam' | 'purpose'>): DeskKind =>
  rev.is_quiz_exam || rev.purpose === 'quiz_exam' ? 'exam' : 'revision';

/**
 * The next exam, else the next revision session — the soonest slot still ahead of `now`.
 * A slot that started less than two hours ago still counts as «now» (the exam is being sat).
 */
export function nextExam(revisions: readonly RevisionSummary[], now: number): NextExam | null {
  const grace = 2 * 60 * 60_000;
  const ahead = revisions
    .map((rev) => ({ rev, kind: kindOf(rev), at: ms(rev.scheduled_at) }))
    .filter((x): x is NextExam => x.at !== null && x.at + grace > now)
    .sort((a, b) => a.at - b.at);
  return ahead.find((x) => x.kind === 'exam') ?? ahead[0] ?? null;
}

export interface Countdown {
  /** The i18n key for the line («بعد ٣ أيام» …) and its number. */
  key: 'revision.in_days' | 'revision.in_hours' | 'revision.in_minutes' | 'revision.now';
  n: number;
  days: number;
  hours: number;
  minutes: number;
}

/** How far `at` is from `now`, in the coarsest unit that is not zero. */
export function countdown(at: number, now: number): Countdown {
  const left = Math.max(0, at - now);
  const minutes = Math.floor(left / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (left <= 0 || minutes === 0) return { key: 'revision.now', n: 0, days, hours, minutes };
  if (days >= 1) return { key: 'revision.in_days', n: days, days, hours, minutes };
  if (hours >= 1) return { key: 'revision.in_hours', n: hours, days, hours, minutes };
  return { key: 'revision.in_minutes', n: minutes, days, hours, minutes };
}

/** The revision sessions whose nearest slot falls on the local day `day` (YYYY-MM-DD). */
export function revisionsOnDay(revisions: readonly RevisionSummary[], day: string): RevisionSummary[] {
  return revisions
    .filter((rev) => { const at = ms(rev.scheduled_at); return at !== null && dayKey(new Date(at)) === day; })
    .sort((a, b) => (ms(a.scheduled_at) ?? 0) - (ms(b.scheduled_at) ?? 0));
}

/** Facts for مدام روز's desk and the hero: this week's (Sat–Fri) sessions and the exams ahead. */
export function revisionFacts(revisions: readonly RevisionSummary[], now: number): { thisWeek: number; examsAhead: number; sessionsAhead: number } {
  const start = weekStart(new Date(now)).getTime();
  const end = addDays(weekStart(new Date(now)), 7).getTime();
  let thisWeek = 0, examsAhead = 0, sessionsAhead = 0;
  for (const rev of revisions) {
    const at = ms(rev.scheduled_at);
    if (at === null) continue;
    if (at >= start && at < end) thisWeek += 1;
    if (at > now) { if (kindOf(rev) === 'exam') examsAhead += 1; else sessionsAhead += 1; }
  }
  return { thisWeek, examsAhead, sessionsAhead };
}

/** A revision session as the day's session card (Home «اليوم», the Sessions tab). */
export interface RevisionCardData extends SessionCardData {
  kind: DeskKind;
  revision_id: number;
  instance_id: number | null;
  billing_mode: RevisionSummary['billing_mode'];
  max_mark?: number | null;
}

export function revisionToCard(rev: RevisionSummary): RevisionCardData {
  return {
    id: `revision-${rev.id}`,
    kind: kindOf(rev),
    revision_id: rev.id,
    instance_id: rev.instance_id,
    billing_mode: rev.billing_mode,
    max_mark: rev.max_mark,
    course_name: rev.title,
    time: rev.scheduled_at ? formatTime(rev.scheduled_at) : null,
    location: null,
    scheduled_at: rev.scheduled_at,
    duration_minutes: null,
    status: 'scheduled',
    tracks_attendance: true,
  };
}

export const isRevisionCard = (s: SessionCardData): s is RevisionCardData => 'revision_id' in s && typeof (s as RevisionCardData).revision_id === 'number';

/** Where a session row stands in the season: a revision, an exam, or an ordinary lesson. */
export function sessionKind(s: Pick<SessionCardData, 'type' | 'is_exam'> & { kind?: DeskKind }): DeskKind | null {
  if (s.kind) return s.kind;
  if (s.is_exam || s.type === 'quiz_exam') return 'exam';
  return null;
}

/**
 * While the season is on, exams and revision sessions come first (exams before revisions,
 * each group in its own order); off, the list is returned exactly as given. Stable.
 */
export function sortForSeason<T extends Pick<SessionCardData, 'type' | 'is_exam'> & { kind?: DeskKind }>(list: readonly T[], on: boolean): T[] {
  if (!on) return [...list];
  const rank = (s: T) => { const k = sessionKind(s); return k === 'exam' ? 0 : k === 'revision' ? 1 : 2; };
  return list.map((s, i) => ({ s, i, r: rank(s) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.s);
}

/** Arabic count form for a number: ١ one, ٢ two, ٣–١٠ few, else many (يوم / يومان / أيام / يومًا). */
export type ArabicCountForm = 'one' | 'two' | 'few' | 'many';
export function arabicCountForm(n: number): ArabicCountForm {
  return n === 1 ? 'one' : n === 2 ? 'two' : n >= 3 && n <= 10 ? 'few' : 'many';
}

/**
 * The countdown as the manage card's hero block: one big number and its unit under it
 * («٣» / «أيام»). `n` is null when the slot is now (the block says «الآن» alone).
 * `unitKey` is an i18n key (revision.unit_<days|hours|minutes>_<form>).
 */
export interface CountdownBlock { n: number | null; unitKey: string }
export function countdownBlock(cd: Countdown): CountdownBlock {
  if (cd.key === 'revision.now') return { n: null, unitKey: 'revision.now' };
  const unit = cd.key === 'revision.in_days' ? 'days' : cd.key === 'revision.in_hours' ? 'hours' : 'minutes';
  // The number is printed above the unit, so 2 takes the plural «٢ أيام» — the dual «يومان»
  // already says "two" and reads «٢ يومان» = "2 two-days" (founder review 2026-10-17).
  const form = arabicCountForm(cd.n);
  return { n: cd.n, unitKey: `revision.unit_${unit}_${form === 'two' ? 'few' : form}` };
}

/**
 * A revision's title as two lines: the exam's own name and its subject. The engine titles
 * them «امتحان شامل — الفيزياء»; the subject is what follows the LAST dash. No dash = no subject.
 */
export function splitRevisionTitle(title: string): { name: string; subject: string | null } {
  const t = (title ?? '').trim();
  const m = t.match(/^(.*\S)\s+[—–-]\s+(\S.*)$/);
  if (!m) return { name: t, subject: null };
  return { name: m[1].trim(), subject: m[2].trim() };
}

/**
 * The share of the season still left before the next exam (0…1), for مدام روز's countdown
 * ring (look C). The span runs from the earliest revision slot already behind us (the
 * season's start as far as the engine knows) to the next exam, never shorter than a week —
 * so a lone exam three days off reads «under half left», not «all of it». Null when nothing
 * is ahead.
 */
export const SEASON_MIN_SPAN_MS = 7 * 24 * 60 * 60_000;
export function seasonShareLeft(revisions: readonly RevisionSummary[], now: number): number | null {
  const next = nextExam(revisions, now);
  if (!next) return null;
  let start = now;
  for (const rev of revisions) {
    const at = ms(rev.scheduled_at);
    if (at !== null && at < start) start = at;
  }
  const span = Math.max(SEASON_MIN_SPAN_MS, next.at - start);
  return Math.min(1, Math.max(0, (next.at - now) / span));
}
