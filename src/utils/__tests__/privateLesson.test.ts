import { tracksAttendance, isPrivateLesson, attendanceLabel } from '../privateLesson';

describe('privateLesson', () => {
  it('reads a missing field as a door course (older payloads keep attendance)', () => {
    expect(tracksAttendance({})).toBe(true);
    expect(tracksAttendance(null)).toBe(true);
    expect(tracksAttendance(undefined)).toBe(true);
    expect(tracksAttendance({ attendance_mode: 'door' })).toBe(true);
    expect(isPrivateLesson({ attendance_mode: 'door' })).toBe(false);
  });

  it('reads attendance_mode none as a private lesson', () => {
    expect(tracksAttendance({ attendance_mode: 'none' })).toBe(false);
    expect(isPrivateLesson({ attendance_mode: 'none' })).toBe(true);
  });

  it('lets tracks_attendance win over attendance_mode when both are present', () => {
    expect(tracksAttendance({ attendance_mode: 'none', tracks_attendance: true })).toBe(true);
    expect(tracksAttendance({ attendance_mode: 'door', tracks_attendance: false })).toBe(false);
    expect(tracksAttendance({ tracks_attendance: null, attendance_mode: 'none' })).toBe(false);
  });

  it('draws the server label when present, else the fallback', () => {
    expect(attendanceLabel({ attendance_label: 'درس خصوصي · بدون تسجيل حضور' }, 'x')).toBe('درس خصوصي · بدون تسجيل حضور');
    expect(attendanceLabel({ attendance_label: '  ' }, 'x')).toBe('x');
    expect(attendanceLabel({ attendance_label: null }, 'x')).toBe('x');
    expect(attendanceLabel(undefined, 'x')).toBe('x');
  });
});
