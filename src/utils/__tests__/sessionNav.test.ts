const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/stores/appConfigStore', () => ({ configRule: () => 30 }));

import { pickCurrentSession, pickScanSession, goToScan, isScannableSession } from '../sessionNav';
import type { TeacherSession } from '@/api/teacher';

const start = new Date('2026-10-12T16:00:00+03:00').getTime();
const at = (min: number) => start + min * 60_000;
const s = (id: string, over: Partial<TeacherSession> = {}): TeacherSession => ({
  id, course_name: `c${id}`, scheduled_at: new Date(start).toISOString(), time: null, duration_minutes: 60,
  location: null, status: 'scheduled', is_current: false, ...over,
});

beforeEach(() => mockPush.mockClear());

/**
 * A private lesson (course attendance_mode 'none', founder 2026-10-12) has no attendance at
 * all, so it is never a scan target. A session without the field is an older server's: a door.
 */
describe('sessionNav — private lessons', () => {
  it('treats a missing tracks_attendance as a door course', () => {
    expect(isScannableSession(s('1'))).toBe(true);
    expect(isScannableSession(s('1', { tracks_attendance: true }))).toBe(true);
    expect(isScannableSession(s('1', { tracks_attendance: false }))).toBe(false);
  });

  it('pickCurrentSession still spotlights a live private lesson by default', () => {
    const priv = s('p', { tracks_attendance: false, attendance_mode: 'none' });
    expect(pickCurrentSession([priv], at(5))?.id).toBe('p');
  });

  it('pickScanSession skips a live private lesson and takes the next door session', () => {
    const priv = s('p', { tracks_attendance: false });
    const later = s('d', { scheduled_at: new Date(at(120)).toISOString() });
    expect(pickScanSession([priv, later], at(5))?.id).toBe('d');
    expect(pickCurrentSession([priv, later], at(5), { scannable: true })?.id).toBe('d');
  });

  it('pickScanSession returns null when only private lessons remain', () => {
    const priv = s('p', { tracks_attendance: false });
    expect(pickScanSession([priv], at(5))).toBeNull();
  });

  it('goToScan opens the scanner for a door session and refuses a private one', () => {
    expect(goToScan(s('d'))).toBe(true);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(String(mockPush.mock.calls[0][0])).toContain('id=d');
    expect(goToScan(s('p', { tracks_attendance: false }))).toBe(false);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
