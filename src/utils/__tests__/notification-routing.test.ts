import { notificationRouteFor } from '../notification-routing';

describe('notificationRouteFor (feed + push taps)', () => {
  it('sends a teacher to the thing the notification is about', () => {
    expect(notificationRouteFor({ role: 'teacher', type: 'ticket_reply', data: { ticket_id: 7 } })).toBe('/(teacher)/tickets/7');
    // A parent opening a ticket reaches the teacher too (2026-10-06), and opens it.
    expect(notificationRouteFor({ role: 'teacher', type: 'ticket_new', data: { ticket_id: 9 } })).toBe('/(teacher)/tickets/9');
    expect(notificationRouteFor({ role: 'teacher', type: 'cash_review', data: { expense_id: 12, event: 'answered' } })).toBe('/(teacher)/expense-thread?id=12');
    expect(notificationRouteFor({ role: 'teacher', type: 'cash_gap', data: { reconciliation_id: 3 } })).toBe('/(teacher)/cash-review?id=3');
    expect(notificationRouteFor({ role: 'teacher', type: 'assistant_checkin_review', data: { session_instance_id: 44 } })).toBe('/(teacher)/sessions/44');
    expect(notificationRouteFor({ role: 'teacher', type: 'invitation_accepted', data: { student_id: 9 } })).toBe('/(teacher)/students/9');
    expect(notificationRouteFor({ role: 'teacher', type: 'admin_ticket_reply', data: { admin_ticket_id: 1 } })).toBe('/(teacher)/resolution');
    // A new streak of unexcused absences (2026-10-12) opens the Resolution Center.
    expect(notificationRouteFor({ role: 'teacher', type: 'termination_candidate', data: { count: 2 } })).toBe('/(teacher)/resolution');
    // …and the parent's line about it opens that child.
    expect(notificationRouteFor({ role: 'parent', type: 'attendance_risk', data: { student_id: 5 } })).toBe('/(parent)/child/5');
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
    expect(notificationRouteFor({ role: 'parent', type: 'attendance' })).toBe('/(parent)/(tabs)');
    expect(notificationRouteFor({ role: 'parent', type: 'payment_received', data: { student_id: 5 } })).toBe('/(parent)/(tabs)/invoices');
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

describe('complaint notifications open where they are about', () => {
  it('routes the teacher to the complaints queue and the family to the disputed record', () => {
    expect(notificationRouteFor({ role: 'teacher', type: 'complaint_filed', data: { complaint_id: 1, type: 'grade' } })).toBe('/(teacher)/complaints');
    expect(notificationRouteFor({ role: 'teacher', type: 'complaint_review', data: {} })).toBe('/(teacher)/complaints');
    expect(notificationRouteFor({ role: 'student', type: 'complaint_decided', data: { type: 'grade' } })).toBe('/(student)/marks');
    expect(notificationRouteFor({ role: 'student', type: 'complaint_decided', data: { type: 'attendance' } })).toBe('/(student)/attendance');
    expect(notificationRouteFor({ role: 'parent', type: 'complaint_decided', data: { type: 'payment' } })).toBe('/(parent)/(tabs)/invoices');
  });

  it('a route the server put on the notification wins — only within the role\'s own screens', () => {
    expect(notificationRouteFor({ role: 'teacher', type: 'brand_new_type', data: { route: '/(teacher)/venues' } })).toBe('/(teacher)/venues');
    expect(notificationRouteFor({ role: 'assistant', type: 'brand_new_type', data: { route: '/(teacher)/venues' }, can: () => false })).toBe('/(teacher)/venues');
    expect(notificationRouteFor({ role: 'parent', type: 'brand_new_type', data: { route: '/(teacher)/venues' } })).toBeNull();
    expect(notificationRouteFor({ role: 'parent', type: 'brand_new_type', data: { route: 'https://evil.example/(parent)/x' } })).toBeNull();
    expect(notificationRouteFor({ role: 'student', type: 'brand_new_type', data: { route: '/(student)/marks?x=1' } })).toBe('/(student)/marks?x=1');
  });
});

describe('chat pushes open the right room (founder 2026-10-12: parents in the chat)', () => {
  it('a parents\' room message opens that room — minus the course id — for parent and teacher', () => {
    const data = { course_id: '12', channel_id: '40', room: 'parents' };
    expect(notificationRouteFor({ role: 'parent', type: 'chat_message', data })).toBe('/(parent)/chat/-12');
    expect(notificationRouteFor({ role: 'teacher', type: 'chat_message', data })).toBe('/(teacher)/conversations/chat/-12');
  });

  it('a students\' room push keeps the course id; a child\'s mute opens the child\'s room for the parent', () => {
    expect(notificationRouteFor({ role: 'teacher', type: 'chat_message', data: { course_id: '12', room: 'students' } })).toBe('/(teacher)/conversations/chat/12');
    expect(notificationRouteFor({ role: 'parent', type: 'chat_muted_parent', data: { course_id: 12 } })).toBe('/(parent)/chat/12');
    expect(notificationRouteFor({ role: 'parent', type: 'chat_message', data: {} })).toBe('/(parent)/(tabs)/community');
  });
});
