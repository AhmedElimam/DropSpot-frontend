import { formatEGP } from '@/utils/currency';
import type { NazerMood } from './manifest';
import type { NazerStampKind } from '@/components/nazer/NazerStamp';

/**
 * What الناظر says today, from the facts the home already holds — no new request. First
 * match wins, in the order a headmaster would raise them: a bill that stops the door, a bill,
 * repeated absence, a word from the teacher (a ticket, then a session note or the day's
 * digest), a full month, then the day's line. He states the
 * fact and the next step; the warmth is in the face, not in praise.
 */
export interface NazerSay {
  mood: NazerMood;
  line: string;
  stamp?: NazerStampKind;
  route?: string;
  routeLabel?: string;
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/** The newest session note a teacher wrote for the family (from «ملاحظات الحصص»). */
export interface FreshNote {
  teacher_name?: string | null;
  course_name?: string | null;
  written_at: string | null;
}

interface LatestNotification {
  type: string;
  created_at: string;
  data?: Record<string, unknown> | null;
}

export interface ParentSignals {
  children: { name: string; student_id: number; attendance_rate: number; present_count: number; absent_count: number }[];
  billing: { student_id: number; student_name?: string | null; amount: number; blocking: boolean }[];
  risks: { student_id: number; student_name?: string | null; course_name?: string | null; absences: number }[];
  latestNotification?: LatestNotification | null;
  freshNote?: FreshNote | null;
  now?: Date;
}

const INVOICES_PARENT = '/(parent)/(tabs)/invoices';
const TICKETS_PARENT = '/(parent)/tickets';
const NOTES_PARENT = '/(parent)/session-notes';
const NOTES_STUDENT = '/(student)/session-notes';
const DAILY = ['daily_1', 'daily_2', 'daily_3', 'daily_4'];

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

function daily(role: 'parent' | 'student', t: T, now: Date): NazerSay {
  return { mood: 'neutral', line: t(`nazer.${role}.${DAILY[dayOfYear(now) % DAILY.length]}`) };
}

/**
 * A teacher's word on a session, within two days: a session-note notification, else the
 * newest note in the history; then the night's digest (one day). Null when none is fresh.
 */
function teacherWord(role: 'parent' | 'student', n: LatestNotification | null | undefined, fresh: FreshNote | null | undefined, t: T, now: Date): NazerSay | null {
  const notes = role === 'parent' ? NOTES_PARENT : NOTES_STUDENT;
  const fromNotification = n && n.type === 'session_notes' && recent(n.created_at, now, 2)
    ? { teacher_name: n.data?.teacher_name as string | null | undefined, course_name: n.data?.course_name as string | null | undefined }
    : null;
  const note = fromNotification ?? (fresh && recent(fresh.written_at ?? undefined, now, 2) ? fresh : null);
  if (note) {
    return { mood: 'checking', line: t(`nazer.${role}.session_note`, { teacher: note.teacher_name ?? '', course: note.course_name ?? '' }), route: notes, routeLabel: t('nazer.see_notes') };
  }
  if (n && n.type === 'daily_digest' && recent(n.created_at, now, 1)) {
    return { mood: 'neutral', line: t(`nazer.${role}.digest`), route: role === 'parent' ? '/(parent)/today' : notes, routeLabel: t(role === 'parent' ? 'nazer.see_today' : 'nazer.see_notes') };
  }
  return null;
}

function recent(iso: string | undefined, now: Date, days: number): boolean {
  if (!iso) return false;
  const at = new Date(iso).getTime();
  return Number.isFinite(at) && now.getTime() - at < days * 86_400_000;
}

export function parentSay(s: ParentSignals, t: T): NazerSay {
  const now = s.now ?? new Date();
  const blocking = s.billing.find((b) => b.blocking);
  if (blocking) {
    return { mood: 'stern', stamp: 'notice', line: t('nazer.parent.due_blocking', { name: blocking.student_name ?? '', amount: formatEGP(blocking.amount) }), route: INVOICES_PARENT, routeLabel: t('nazer.see_invoices') };
  }
  const due = s.billing[0];
  if (due) {
    return { mood: 'sad', line: t('nazer.parent.due', { name: due.student_name ?? '', amount: formatEGP(due.amount) }), route: INVOICES_PARENT, routeLabel: t('nazer.see_invoices') };
  }
  const risk = [...s.risks].sort((a, b) => b.absences - a.absences)[0];
  if (risk) {
    return { mood: 'tender', line: t('nazer.parent.absences', { name: risk.student_name ?? '', count: risk.absences, course: risk.course_name ?? '' }), route: `/(parent)/child/${risk.student_id}`, routeLabel: t('nazer.see_child', { name: risk.student_name ?? '' }) };
  }
  const n = s.latestNotification;
  if (n && n.type === 'ticket_new' && recent(n.created_at, now, 2)) {
    return { mood: 'checking', line: t('nazer.parent.ticket'), route: TICKETS_PARENT, routeLabel: t('nazer.see_tickets') };
  }
  const word = teacherWord('parent', n, s.freshNote, t, now);
  if (word) return word;
  if (s.children.length === 0) {
    return { mood: 'neutral', line: t('nazer.parent.welcome') };
  }
  const settled = s.children.filter((c) => c.present_count + c.absent_count >= 4);
  if (settled.length === s.children.length && settled.every((c) => c.attendance_rate >= 90)) {
    return { mood: 'proud', stamp: 'approved', line: t('nazer.parent.all_excellent') };
  }
  return daily('parent', t, now);
}

export interface StudentSignals {
  billing: { amount: number; blocking: boolean }[];
  risks: { course_name?: string | null; absences: number }[];
  coverage: { present: number; late: number; absent: number; total: number };
  live?: { course_name?: string | null; checked_in?: boolean } | null;
  next?: { course_name?: string | null; scheduled_at: string } | null;
  latestNotification?: LatestNotification | null;
  freshNote?: FreshNote | null;
  now?: Date;
}

const INVOICES_STUDENT = '/(student)/(tabs)/invoices';

export function studentSay(s: StudentSignals, t: T): NazerSay {
  const now = s.now ?? new Date();
  const blocking = s.billing.find((b) => b.blocking);
  if (blocking) {
    return { mood: 'stern', stamp: 'notice', line: t('nazer.student.due_blocking', { amount: formatEGP(blocking.amount) }), route: INVOICES_STUDENT, routeLabel: t('nazer.see_invoices') };
  }
  if (s.billing[0]) {
    return { mood: 'sad', line: t('nazer.student.due', { amount: formatEGP(s.billing[0].amount) }), route: INVOICES_STUDENT, routeLabel: t('nazer.see_invoices') };
  }
  if (s.live && !s.live.checked_in) {
    return { mood: 'checking', line: t('nazer.student.live_now', { course: s.live.course_name ?? '' }), route: '/(student)/(tabs)/check-in', routeLabel: t('nazer.check_in') };
  }
  const risk = [...s.risks].sort((a, b) => b.absences - a.absences)[0];
  if (risk) {
    return { mood: 'tender', line: t('nazer.student.absences', { count: risk.absences, course: risk.course_name ?? '' }), route: '/(student)/attendance', routeLabel: t('nazer.see_attendance') };
  }
  const word = teacherWord('student', s.latestNotification, s.freshNote, t, now);
  if (word) return word;
  const c = s.coverage;
  if (c.total >= 4) {
    const pct = Math.round(((c.present + c.late) / c.total) * 100);
    if (pct >= 90) return { mood: 'proud', stamp: 'approved', line: t('nazer.student.excellent', { pct }) };
  }
  if (s.next) {
    const at = new Date(s.next.scheduled_at).getTime();
    if (Number.isFinite(at) && at - now.getTime() > 0 && at - now.getTime() < 2 * 3_600_000) {
      return { mood: 'checking', line: t('nazer.student.soon', { course: s.next.course_name ?? '' }), route: '/(student)/(tabs)/check-in', routeLabel: t('nazer.see_sessions') };
    }
  }
  return daily('student', t, now);
}
