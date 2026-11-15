import type { CourseSummary } from '@/api/courses';
import { arabicTimes, courseSearchScore } from '../courseSearch';

const words = { private: 'درس خصوصي', hidden: 'خاص', noLocation: 'بدون موقع' };
const course = (over: Partial<CourseSummary>): CourseSummary => ({
  id: '1', name: 'رياضيات', grade_name: null, students_count: 0, radius_horizontal_meters: 20, has_location: true,
  phone_checkin_active: true, slot_count: 1, upcoming_count: 0, ...over,
});
const a = course({ id: '1', name: 'الثالث الإعدادي-أزهر -المنيل', grade_name: 'الصف الثالث الإعدادي', schedule_label: 'الجمعة 10:00 AM، السبت 4:00 PM' });
const b = course({ id: '2', name: 'مراجعة نهائية', grade_name: 'الصف الثاني الثانوي', schedule_label: 'الأحد 6:00 PM', phone_checkin_active: false });
const p = course({ id: '3', name: 'خصوصي أحمد', tracks_attendance: false, attendance_label: 'درس خصوصي · بدون تسجيل حضور' });
const hits = (q: string) => [a, b, p].filter((c) => courseSearchScore(c, q, words) > 0).map((c) => c.id);

describe('«المقررات» search', () => {
  it('an empty query keeps every course', () => expect(hits('  ')).toEqual(['1', '2', '3']));

  it('finds by part of the name, with the letters typed loosely (ا/أ, ة/ه)', () => {
    expect(hits('ازهر')).toEqual(['1']);
    expect(hits('مراجعه')).toEqual(['2']);
  });

  it('finds by grade, by day and by a time in ص/م with Arabic digits', () => {
    expect(hits('الثاني الثانوي')).toEqual(['2']);
    expect(hits('السبت')).toEqual(['1']);
    expect(hits('الاحد')).toEqual(['2']);
    expect(hits('٤:٠٠ م')).toEqual(['1']);
  });

  it('every word must match: name + day narrows', () => {
    expect(hits('الثالث الجمعة')).toEqual(['1']);
    expect(hits('الثالث الأحد')).toEqual([]);
  });

  it('finds the kind and what a row warns about', () => {
    expect(hits('خصوصي')).toEqual(['3']);
    expect(hits('بدون موقع')).toEqual(['2']);
  });

  it('a name match ranks above a grade match', () => {
    const name = courseSearchScore(course({ name: 'الثالث' }), 'الثالث', words);
    const grade = courseSearchScore(course({ name: 'فيزياء', grade_name: 'الثالث' }), 'الثالث', words);
    expect(name).toBeGreaterThan(grade);
  });

  it('AM/PM read as ص/م', () => expect(arabicTimes('الأحد 9:00 AM، الثلاثاء 5:00 PM')).toBe('الأحد 9:00 ص، الثلاثاء 5:00 م'));
});
