/**
 * A time clash the server refused (422 SCHEDULE_CONFLICT, backend SessionSchedule::assertSlotsFree):
 * since 2026-11-15 it lists EVERY clash and the course each one hits (founder: «if there's a
 * conflict show with which»). An older server sends only `message` — `scheduleConflicts` is then
 * an empty list and the caller shows the message as it is.
 */
export type ConflictWith = {
  kind: 'course' | 'same_request';
  course_id: number | null;
  course_name: string | null;
  /** same_request: the other slot of the form, 0-based. */
  slot_index: number | null;
  day_label: string;
  start_time: string;
  end_time: string;
};

export type ScheduleConflict = {
  /** The form's slot, 0-based; null when a single slot was sent. */
  slot_index: number | null;
  day_of_week: number;
  day_label: string;
  start_time: string;
  end_time: string;
  with: ConflictWith;
};

type ErrorLike = { response?: { status?: number; data?: { code?: unknown; conflicts?: unknown; message?: unknown } } };

export function isScheduleConflict(e: unknown): boolean {
  return (e as ErrorLike)?.response?.data?.code === 'SCHEDULE_CONFLICT';
}

/** The clashes the server listed; rows missing what a line needs are dropped, never crash. */
export function scheduleConflicts(e: unknown): ScheduleConflict[] {
  const raw = (e as ErrorLike)?.response?.data?.conflicts;
  if (!isScheduleConflict(e) || !Array.isArray(raw)) return [];
  return raw.filter((c): c is ScheduleConflict =>
    !!c && typeof c === 'object'
    && typeof (c as ScheduleConflict).start_time === 'string'
    && typeof (c as ScheduleConflict).end_time === 'string'
    && !!(c as ScheduleConflict).with && typeof (c as ScheduleConflict).with.start_time === 'string');
}

/** The form's slots a clash touches (both sides of a clash inside the form), to mark them red. */
export function conflictingSlotIndexes(conflicts: ScheduleConflict[]): Set<number> {
  const out = new Set<number>();
  for (const c of conflicts) {
    if (typeof c.slot_index === 'number') out.add(c.slot_index);
    if (c.with.kind === 'same_request' && typeof c.with.slot_index === 'number') out.add(c.with.slot_index);
  }
  return out;
}
