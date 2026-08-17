/**
 * Maps a notification (push tap OR in-app feed tap) to a parent-app route. Kept in
 * one place so the push-response handler and the notifications feed screen route
 * identically. Returns null when a type has no deep destination (the tap just marks
 * it read). Child routes use the student id, which equals the child `id` returned by
 * /parents/children.
 */
export function notificationRoute(type: string, data?: Record<string, unknown> | null): string | null {
  const studentId = (data?.student_id ?? data?.studentId) as string | number | undefined;

  switch (type) {
    case 'monthly_report':
    case 'student_report':
      return '/(parent)/report-cards';
    case 'daily_digest':
      return '/(parent)/notifications';
    case 'invoice':
    case 'invoice_new':
    case 'invoice_overdue':
      return '/(parent)/invoices';
    case 'attendance':
    case 'absence':
    case 'left_early':
    case 'grade':
      return studentId != null ? `/(parent)/child/${studentId}` : null;
    default:
      return null;
  }
}
