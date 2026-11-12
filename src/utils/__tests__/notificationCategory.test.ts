import { notificationCategory } from '../notificationCategory';

describe('notificationCategory', () => {
  it.each([
    ['payment_proof_submitted', 'money'],
    ['invoice_overdue', 'money'],
    ['cash_gap', 'money'],
    ['attendance', 'attendance'],
    ['assistant_checkin_review', 'attendance'],
    ['session_swap', 'attendance'],
    // «حصة أونلاين» is on air: a session, filed with attendance (where it is recorded).
    ['remote_session_live', 'attendance'],
    ['card_order_delivered', 'students'],
    ['booking_request', 'students'],
    ['student_report_safety', 'students'],
    ['admin_ticket_reply', 'followup'],
    ['assistant_action_review', 'followup'],
    ['homework', 'followup'],
    ['homework_streak', 'followup'],
    ['something_new', 'other'],
  ])('%s → %s', (type, cat) => {
    expect(notificationCategory(type)).toBe(cat);
  });
});
