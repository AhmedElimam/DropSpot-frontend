/**
 * «نوع المقرر: حضوري / أونلاين» — how a course's sessions are held, said in advance (founder
 * 2026-11-12: «the course type is hidden on موعد — we want this to be a type of course: either
 * it's fully remote or physical»). The decisions, kept pure (no React, no native module) so each
 * is tested on its own: what a row's `delivery` means, where the «أونلاين» chip is drawn, which
 * scopes the teacher is offered, and what a student is told while an online session has not
 * started yet.
 *
 * The COURSE is the unit: a course row's `delivery` is its type (chosen at creation, changed on
 * the course page; its groups and upcoming sessions move with it, and new sessions are born
 * with it). A session row's `delivery` is that session's own answer — one session can still be
 * an exception. The server reports `in_person` while «حصة أونلاين» is off for that teacher — and
 * an older server reports nothing, which reads the same.
 */

export type SessionDelivery = 'in_person' | 'remote';

/** One session · that session's whole course from now on (its type) · every course of this teacher. */
export type DeliveryScope = 'session' | 'course' | 'all';

/** The push / feed type sent to the students and their parents when the teacher changes it. */
export const DELIVERY_CHANGED_NOTIFICATION = 'session_delivery_changed';

/** Anything that is not exactly `remote` is in person (absent on an older server, null, a typo). */
export function deliveryOf(value: unknown): SessionDelivery {
  return value === 'remote' ? 'remote' : 'in_person';
}

export function otherDelivery(delivery: SessionDelivery): SessionDelivery {
  return delivery === 'remote' ? 'in_person' : 'remote';
}

/** Is this row held online? */
export function isRemoteDelivery(row: { delivery?: unknown } | null | undefined): boolean {
  return !!row && deliveryOf(row.delivery) === 'remote';
}

// ── The «أونلاين» chip ─────────────────────────────────────────────────────────────────────

/**
 * Is the «أونلاين» chip drawn on this row? Only while the feature is on for the person, the
 * row is online, and it was not cancelled. It stays on a session that is over: it was held
 * online, and the record should say so.
 */
export function showsOnlineChip(row: { delivery?: unknown; status?: string | null } | null | undefined, featureOn: boolean): boolean {
  return featureOn && isRemoteDelivery(row) && row?.status !== 'cancelled';
}

// ── What the teacher is offered ────────────────────────────────────────────────────────────

/** From a session: the three scopes, the narrowest first. From the course page there is nothing to choose — it is that course. */
export function deliveryScopeOptions(from: 'session' | 'course'): DeliveryScope[] {
  return from === 'session' ? ['session', 'course', 'all'] : ['course'];
}

/**
 * Is the course page's «نوع المقرر» control drawn? The feature on, and a course the server sent
 * a `delivery` for (an older server sends none: nothing to switch).
 */
export function showsCourseDeliveryControl(course: { delivery?: unknown } | null | undefined, featureOn: boolean): boolean {
  return featureOn && !!course && (course.delivery === 'remote' || course.delivery === 'in_person');
}

/**
 * On the create form: the fields that only mean something in a place (venue, phone geofence
 * check-in, radius) are offered only for an in-person course.
 */
export function needsAPlace(delivery: SessionDelivery): boolean {
  return delivery !== 'remote';
}

interface Timed {
  status?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  is_cancelled?: boolean;
  is_completed?: boolean;
}

/** When the session ends (60 minutes when the row carries no length), or null without a start. */
function endsAt(row: Timed): number | null {
  if (!row.scheduled_at) return null;
  const start = new Date(row.scheduled_at).getTime();
  if (Number.isNaN(start)) return null;
  return start + (Number(row.duration_minutes) > 0 ? Number(row.duration_minutes) : 60) * 60_000;
}

/**
 * May the teacher change how this session is held? The server's own rule: not a cancelled
 * session, not a completed one, not one whose time is over. So the control is not drawn on a
 * session it would only be refused for.
 */
export function canChangeDelivery(row: Timed | null | undefined, now: number): boolean {
  if (!row) return false;
  if (row.is_cancelled || row.is_completed || row.status === 'cancelled' || row.status === 'completed') return false;
  const end = endsAt(row);
  return end !== null && end > now;
}

/** Is the control drawn at all? The feature on, a row the server sent a `delivery` for, a session that can still change. */
export function showsDeliveryControl(row: (Timed & { delivery?: unknown }) | null | undefined, featureOn: boolean, now: number): boolean {
  return featureOn && !!row && (row.delivery === 'remote' || row.delivery === 'in_person') && canChangeDelivery(row, now);
}

// ── What a student is told ─────────────────────────────────────────────────────────────────

/**
 * An online session that the teacher has not opened yet: the student is told «الحصة دي
 * أونلاين — هتبدأ لما المدرّس يفتحها» in place of the door's check-in. Not once it is on air
 * (the «ادخل» button is there instead), not once the student has an outcome, and not for a
 * session that is cancelled or over.
 */
export function waitsForTeacher(
  row: (Timed & { delivery?: unknown; remote?: { live?: boolean } | null; attendance_status?: string | null }) | null | undefined,
  featureOn: boolean,
  now: number,
): boolean {
  if (!featureOn || !row || !isRemoteDelivery(row)) return false;
  if (row.remote?.live === true || row.attendance_status) return false;
  return canChangeDelivery(row, now);
}

// ── Words ──────────────────────────────────────────────────────────────────────────────────

export function deliveryLabelKey(delivery: SessionDelivery): string {
  return delivery === 'remote' ? 'remote.delivery_remote' : 'remote.delivery_in_person';
}

const SCOPE_KEYS: Record<DeliveryScope, string> = {
  session: 'remote.scope_session',
  course: 'remote.scope_course',
  all: 'remote.scope_all',
};
export function scopeLabelKey(scope: DeliveryScope): string {
  return SCOPE_KEYS[scope];
}

const SCOPE_HINT_KEYS: Record<DeliveryScope, string> = {
  session: 'remote.scope_session_hint',
  course: 'remote.scope_course_hint',
  all: 'remote.scope_all_hint',
};
export function scopeHintKey(scope: DeliveryScope): string {
  return SCOPE_HINT_KEYS[scope];
}

/** The sheet's title: «تخلّي الحصة أونلاين؟» / «ترجّع الحصة حضوري؟». */
export function deliveryAskKey(to: SessionDelivery): string {
  return to === 'remote' ? 'remote.delivery_ask_remote' : 'remote.delivery_ask_in_person';
}

/** The course page's question: «تخلّي المقرر أونلاين؟» / «ترجّع المقرر حضوري؟». */
export function courseAskKey(to: SessionDelivery): string {
  return to === 'remote' ? 'remote.course_ask_remote' : 'remote.course_ask_in_person';
}

/** What is said once it is done — by scope and direction (the families were told once). */
export function deliveryDoneKey(to: SessionDelivery, scope: DeliveryScope): string {
  const dir = to === 'remote' ? 'remote' : 'in_person';
  return `remote.delivery_done_${scope}_${dir}`;
}
