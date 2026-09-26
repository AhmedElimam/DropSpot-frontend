import type { UserRole } from '@/stores/authStore';

/**
 * Where a notification takes you when tapped — from the in-app feed or from a push (the
 * FCM payload is `type` + the same `data` the row carries), so both taps land in one place.
 *
 * The server sends no route: a row is `type` plus entity ids (student_id, ticket_id,
 * expense_id, …). This table turns those into the screen where the thing can be dealt
 * with. Returns null when there is nowhere better than the feed itself; the tap then only
 * marks the row read. Kept per ROLE because the same type means a different screen to a
 * parent (their child) and to a teacher (the student's profile).
 *
 * For an assistant, `can` keeps a tap off a screen the server would refuse them
 * (founder 2026-09-26: never show what they can't use) — the row is still readable, it
 * just doesn't open anything.
 */
export type NotificationRouteInput = {
  role: UserRole | null;
  type: string;
  data?: Record<string, unknown> | null;
  /** Ability check for assistants; true for everyone else. */
  can?: (ability: string) => boolean;
};

function id(data: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = data?.[k];
    if (v === 0 || (v != null && v !== '')) return String(v);
  }
  return null;
}

/** Admin-ticket lifecycle types reach whoever filed the ticket, whatever their role. */
const ADMIN_TICKET_TYPES = new Set(['admin_ticket_reply', 'admin_ticket_resolved', 'admin_ticket_waiting', 'admin_ticket_progress']);

function teacherRoute(type: string, data: Record<string, unknown> | null | undefined, isAssistant: boolean, can: (a: string) => boolean): string | null {
  const student = id(data, 'student_id');
  const session = id(data, 'session_instance_id', 'session_id');
  const course = id(data, 'course_id');

  if (ADMIN_TICKET_TYPES.has(type)) return '/(teacher)/resolution';

  switch (type) {
    // ── students ──
    case 'invitation_accepted':
    case 'guardian_disputed':
    case 'student_report_safety':
      return student ? `/(teacher)/students/${student}` : '/(teacher)/students';
    case 'left_early':
    case 'assistant_checkin_review':
    case 'assistant_session_created':
      return session ? `/(teacher)/students/session/${session}` : '/(teacher)/students';
    case 'booking_request':
      return can('manage_students') ? '/(teacher)/booking-requests' : null;
    case 'student_edit_request_family':
    case 'student_edit_result':
    case 'assistant_report_review':
      return '/(teacher)/resolution';
    case 'card_order_delivered':
      return can('manage_students') ? '/(teacher)/students?segment=cards' : null;

    // ── courses ──
    case 'assistant_course_created':
    case 'assistant_schedule_created':
      return course ? `/(teacher)/courses/${course}` : '/(teacher)/courses';

    // ── money ──
    case 'payment_proof_submitted':
    case 'payment_proof':
      return can('review_payment_proofs') ? '/(teacher)/payment-proofs' : null;
    case 'billing_override_granted_by_assistant':
      // The override itself is listed on the home screen; with a student, their profile.
      return student ? `/(teacher)/students/${student}` : '/(teacher)';
    case 'assistant_action_review':
      return isAssistant ? null : '/(teacher)/assistant-actions';
    case 'financial_report':
      return isAssistant ? null : '/(teacher)/insights';
    case 'subscription_expired':
      return isAssistant ? null : '/(teacher)/settings';

    // ── مدام روز ──
    case 'cash_review': {
      const expense = id(data, 'expense_id');
      return expense && can('scan_attendance') ? `/(teacher)/expense-thread?id=${expense}` : null;
    }
    case 'cash_gap': {
      const row = id(data, 'reconciliation_id');
      if (isAssistant) return can('scan_attendance') ? '/(teacher)/cash-reconcile' : null;
      return row ? `/(teacher)/cash-review?id=${row}` : '/(teacher)/cash-reconcile';
    }
    case 'cash_handover':
    case 'cash_reconciliation':
    case 'cash_insight':
      return can('scan_attendance') ? '/(teacher)/cash-reconcile' : null;
    case 'expense_reminder':
      return can('scan_attendance') ? '/(teacher)/expenses' : null;

    // ── phone / tickets ──
    case 'device_pending_scans':
      return '/(teacher)/reconcile';
    case 'ticket_reply': {
      const ticket = id(data, 'ticket_id');
      return ticket ? `/(teacher)/tickets/${ticket}` : '/(teacher)/tickets';
    }
    default:
      return null;
  }
}

function parentRoute(type: string, data: Record<string, unknown> | null | undefined): string | null {
  const student = id(data, 'student_id', 'studentId');
  const child = student ? `/(parent)/child/${student}` : '/(parent)';

  if (ADMIN_TICKET_TYPES.has(type)) return '/(parent)/support';

  switch (type) {
    case 'payment_received':
    case 'invoice':
    case 'invoice_new':
    case 'invoice_overdue':
    case 'payment_proof_approved':
    case 'payment_proof_rejected':
    case 'billing_override_granted':
      return '/(parent)/invoices';
    case 'monthly_report':
    case 'student_report':
      return '/(parent)/report-cards';
    case 'daily_digest':
      return '/(parent)/today';
    case 'attendance':
    case 'absence':
    case 'left_early':
    case 'grade':
    case 'special_session':
    case 'enrollment_approved':
    case 'enrollment_transfer':
    case 'student_termination':
    case 'session_swap':
    case 'discrepancy_resolved':
    case 'excuse_resolved':
    case 'card_issued':
    case 'card_handover':
    case 'precard_invitation':
    case 'graduation_notice':
    case 'student_linked':
      return child;
    // The sibling gate's confirm/deny card lives on the parent home screen.
    case 'sibling_claim':
      return '/(parent)';
    case 'student_edit_result':
      return '/(parent)/children';
    case 'parent_number_approved':
      return '/(parent)/profile';
    case 'ticket_reply': {
      const ticket = id(data, 'ticket_id');
      return ticket ? `/(parent)/tickets/${ticket}` : '/(parent)/tickets';
    }
    default:
      return null;
  }
}

function studentRoute(type: string, data: Record<string, unknown> | null | undefined): string | null {
  if (ADMIN_TICKET_TYPES.has(type)) return '/(student)/support';

  switch (type) {
    case 'invoice_new':
    case 'invoice_overdue':
    case 'payment_received':
      return '/(student)/invoices';
    case 'grade':
      return '/(student)/marks';
    case 'card_preparing':
    case 'card_released':
      return '/(student)/order-card';
    case 'special_session':
    case 'booking_request_result':
    case 'parent_unreachable':
      return '/(student)';
    case 'student_edit_result':
      return '/(student)/profile';
    case 'ticket_reply':
      return '/(student)/support';
    default:
      return null;
  }
}

export function notificationRouteFor({ role, type, data, can }: NotificationRouteInput): string | null {
  const allow = can ?? (() => true);
  switch (role) {
    case 'teacher':
      return teacherRoute(type, data, false, () => true);
    case 'assistant':
      return teacherRoute(type, data, true, allow);
    case 'parent':
      return parentRoute(type, data);
    case 'student':
      return studentRoute(type, data);
    default:
      return null;
  }
}

/** The parent mapping under its old name — kept for the parent layout's push handler. */
export function notificationRoute(type: string, data?: Record<string, unknown> | null): string | null {
  return parentRoute(type, data);
}
