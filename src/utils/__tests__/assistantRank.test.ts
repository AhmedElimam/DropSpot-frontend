import { assistantRank } from '../assistantRank';

const ALL = [
  'scan_attendance', 'mark_attendance_manual', 'reply_tickets', 'manage_students', 'manage_sessions', 'review_payment_proofs',
  'issue_guest_passes', 'export_reports', 'report_incidents', 'manage_courses', 'edit_bill_amount', 'cancel_sessions',
];

describe('assistantRank', () => {
  it('reads nothing as no rank', () => {
    expect(assistantRank([], ALL).key).toBe('none');
  });

  it('puts a new assistant (the server defaults) at the door', () => {
    expect(assistantRank(['scan_attendance', 'report_incidents', 'edit_bill_amount'], ALL)).toMatchObject({ key: 'door', level: 1, title: 'مساعد الباب' });
  });

  it('weighs trust, not count: one schedule power outranks the whole door', () => {
    expect(assistantRank(['manage_students'], ALL).key).toBe('desk');
    expect(assistantRank(['scan_attendance', 'mark_attendance_manual', 'issue_guest_passes', 'cancel_sessions'], ALL).key).toBe('executive');
  });

  it('gives the right hand to whoever holds every ability', () => {
    expect(assistantRank(ALL, ALL)).toMatchObject({ key: 'right_hand', level: 4 });
    expect(assistantRank(ALL.slice(1), ALL).key).toBe('executive');
  });

  it('never lifts a rank for an ability it does not know', () => {
    expect(assistantRank(['some_future_power'], ALL).key).toBe('door');
  });
});
