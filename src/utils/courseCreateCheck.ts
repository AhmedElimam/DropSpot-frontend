/**
 * What still stops «إنشاء مقرر» (founder 2026-11-14: «the create button stayed disabled even
 * after all the required fields» — the button now stays active and says what is missing).
 * Pure, so the rules are tested apart from the screen; the same rules the button used to gate
 * on, each with its own reason.
 *
 * The usual trap was a weekly slot whose end is not after its start: the time picker opens on
 * «مساءً», so «10 to 11» could be saved as 10 PM → 11 AM, and only a red border said so.
 */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The server's own bounds (backend Course::MIN/MAX_SESSIONS_PER_CYCLE, TeacherCourseController::store):
 *  outside them it refuses with a default ENGLISH message, so the form names them first. */
export const MIN_CYCLE_SESSIONS = 4;
export const MAX_CYCLE_SESSIONS = 20;
export const MAX_PRICE = 1_000_000;
export const MAX_CAPACITY = 1000;
export const MAX_SLOTS = 7;

export type CourseCreateSlot = { day_of_week: number; start_time: string; end_time: string };

export type CourseCreateInput = {
  name: string;
  gradeId: string | null;
  termId: string | null;
  startMode: 'now' | 'date';
  startDate: string | null;
  slots: CourseCreateSlot[];
  cycleSessions: string;
  cyclePrice: string;
  /** Optional; when typed it must be 1–MAX_CAPACITY. */
  capacity?: string;
};

export type CourseCreateProblem =
  | { kind: 'name' }
  | { kind: 'grade' }
  | { kind: 'term' }
  | { kind: 'start_date' }
  /** `index` is 0-based; `reason` says which half is wrong. */
  | { kind: 'slot'; index: number; reason: 'time_missing' | 'end_not_after_start' }
  | { kind: 'cycle_sessions' }
  | { kind: 'cycle_price' }
  | { kind: 'capacity' }
  | { kind: 'slots_count' };

export function courseCreateProblems(f: CourseCreateInput): CourseCreateProblem[] {
  const out: CourseCreateProblem[] = [];
  if (!f.name.trim()) out.push({ kind: 'name' });
  if (!f.gradeId) out.push({ kind: 'grade' });
  if (!f.termId) out.push({ kind: 'term' });
  if (f.startMode === 'date' && !f.startDate) out.push({ kind: 'start_date' });
  if (f.slots.length > MAX_SLOTS) out.push({ kind: 'slots_count' });
  f.slots.forEach((s, index) => {
    if (!TIME_RE.test(s.start_time) || !TIME_RE.test(s.end_time)) out.push({ kind: 'slot', index, reason: 'time_missing' });
    else if (s.end_time <= s.start_time) out.push({ kind: 'slot', index, reason: 'end_not_after_start' });
  });
  const sessions = parseInt(f.cycleSessions, 10);
  if (!(sessions >= MIN_CYCLE_SESSIONS && sessions <= MAX_CYCLE_SESSIONS)) out.push({ kind: 'cycle_sessions' });
  const price = parseFloat(f.cyclePrice);
  if (!(price >= 1 && price <= MAX_PRICE)) out.push({ kind: 'cycle_price' });
  const cap = (f.capacity ?? '').trim();
  if (cap && !(Number(cap) >= 1 && Number(cap) <= MAX_CAPACITY)) out.push({ kind: 'capacity' });
  return out;
}
