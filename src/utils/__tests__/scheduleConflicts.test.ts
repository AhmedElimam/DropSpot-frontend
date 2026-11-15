import { conflictingSlotIndexes, isScheduleConflict, scheduleConflicts } from '../scheduleConflicts';

const err = (data: unknown) => ({ response: { status: 422, data } });
const withCourse = { kind: 'course', course_id: 9, course_name: 'الثالث الإعدادي', slot_index: null, day_label: 'الجمعة', start_time: '10:00', end_time: '11:00' };

describe('a refused time clash (422 SCHEDULE_CONFLICT)', () => {
  it('reads every clash the server listed', () => {
    const e = err({ code: 'SCHEDULE_CONFLICT', message: 'x', conflicts: [
      { slot_index: 0, day_of_week: 5, day_label: 'الجمعة', start_time: '10:30', end_time: '11:30', with: withCourse },
      { slot_index: 2, day_of_week: 2, day_label: 'الثلاثاء', start_time: '18:00', end_time: '20:00', with: { ...withCourse, kind: 'same_request', course_id: null, course_name: null, slot_index: 1 } },
    ] });
    expect(isScheduleConflict(e)).toBe(true);
    const list = scheduleConflicts(e);
    expect(list).toHaveLength(2);
    expect(list[0].with.course_name).toBe('الثالث الإعدادي');
    expect([...conflictingSlotIndexes(list)].sort()).toEqual([0, 1, 2]);
  });

  it('an older server (message only), another error, or a malformed row gives no list', () => {
    expect(scheduleConflicts(err({ code: 'SCHEDULE_CONFLICT', message: 'يتعارض' }))).toEqual([]);
    expect(scheduleConflicts(err({ code: 'OTHER', conflicts: [] }))).toEqual([]);
    expect(isScheduleConflict(new Error('network'))).toBe(false);
    expect(scheduleConflicts(err({ code: 'SCHEDULE_CONFLICT', conflicts: [null, { slot_index: 0 }, 'x'] }))).toEqual([]);
  });
});
