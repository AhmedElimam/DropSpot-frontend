import { notificationRouteFor } from '../notification-routing';

describe('notificationRouteFor (feed + push taps)', () => {
  it('sends a teacher to the thing the notification is about', () => {
    expect(notificationRouteFor({ role: 'teacher', type: 'ticket_reply', data: { ticket_id: 7 } })).toBe('/(teacher)/tickets/7');
    expect(notificationRouteFor({ role: 'teacher', type: 'cash_review', data: { expense_id: 12, event: 'answered' } })).toBe('/(teacher)/expense-thread?id=12');
    expect(notificationRouteFor({ role: 'teacher', type: 'cash_gap', data: { reconciliation_id: 3 } })).toBe('/(teacher)/cash-review?id=3');
    expect(notificationRouteFor({ role: 'teacher', type: 'assistant_checkin_review', data: { session_instance_id: 44 } })).toBe('/(teacher)/students/session/44');
    expect(notificationRouteFor({ role: 'teacher', type: 'invitation_accepted', data: { student_id: 9 } })).toBe('/(teacher)/students/9');
    expect(notificationRouteFor({ role: 'teacher', type: 'admin_ticket_reply', data: { admin_ticket_id: 1 } })).toBe('/(teacher)/resolution');
  });

  it('never sends an assistant to a screen the server would refuse them', () => {
    const none = () => false;
    const all = () => true;
    expect(notificationRouteFor({ role: 'assistant', type: 'payment_proof_submitted', data: { invoice_id: 1 }, can: none })).toBeNull();
    expect(notificationRouteFor({ role: 'assistant', type: 'payment_proof_submitted', data: { invoice_id: 1 }, can: all })).toBe('/(teacher)/payment-proofs');
    expect(notificationRouteFor({ role: 'assistant', type: 'cash_gap', data: { reconciliation_id: 3 }, can: all })).toBe('/(teacher)/cash-reconcile');
    expect(notificationRouteFor({ role: 'assistant', type: 'financial_report', can: all })).toBeNull();
    expect(notificationRouteFor({ role: 'assistant', type: 'assistant_removed', data: { teacher_id: 2 }, can: all })).toBeNull();
  });

  it('sends a parent to the child and the family screens', () => {
    expect(notificationRouteFor({ role: 'parent', type: 'attendance', data: { student_id: 5, student_name: 'x' } })).toBe('/(parent)/child/5');
    expect(notificationRouteFor({ role: 'parent', type: 'attendance' })).toBe('/(parent)');
    expect(notificationRouteFor({ role: 'parent', type: 'payment_received', data: { student_id: 5 } })).toBe('/(parent)/invoices');
    expect(notificationRouteFor({ role: 'parent', type: 'daily_digest', data: { student_id: 5 } })).toBe('/(parent)/today');
    expect(notificationRouteFor({ role: 'parent', type: 'ticket_reply', data: { ticket_id: 8 } })).toBe('/(parent)/tickets/8');
  });

  it('sends a student to their own screens and ignores the unknown', () => {
    expect(notificationRouteFor({ role: 'student', type: 'grade', data: { mark: 9 } })).toBe('/(student)/marks');
    expect(notificationRouteFor({ role: 'student', type: 'card_released', data: { student_id: 5 } })).toBe('/(student)/order-card');
    expect(notificationRouteFor({ role: 'student', type: 'test_notification' })).toBeNull();
    expect(notificationRouteFor({ role: null, type: 'grade' })).toBeNull();
  });
});
