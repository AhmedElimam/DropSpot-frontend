jest.mock('expo-video', () => ({ createVideoPlayer: jest.fn() }));
import { doorToneFor } from '../doorTones';
import type { ScanResult } from '@/api/teacher';

const scan = (r: Partial<ScanResult>): ScanResult => ({ success: true, message: '', student_name: null, ...r } as ScanResult);

describe('doorToneFor', () => {
  it('plays the server sound when it sends one — the homework bell included (2026-11-11)', () => {
    expect(doorToneFor(scan({ door_tone: 'clear', door_sound: 'homework' }))).toBe('homework');
    expect(doorToneFor(scan({ door_tone: 'bill', door_sound: 'bill' }))).toBe('bill');
  });

  it('falls back to door_tone on a server from before, then to the dues', () => {
    expect(doorToneFor(scan({ door_tone: 'absent' }))).toBe('absent');
    expect(doorToneFor(scan({}))).toBe('clear');
    expect(doorToneFor(scan({ success: false, code: 'BILLING_OVERDUE' }))).toBe('bill');
    expect(doorToneFor(scan({ success: false, code: 'NOT_ENROLLED' }))).toBeNull();
  });
});
