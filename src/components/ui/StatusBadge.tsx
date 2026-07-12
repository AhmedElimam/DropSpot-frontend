import { useTranslation } from 'react-i18next';
import { Badge, type BadgeVariant } from './Badge';

/**
 * Single source of truth: every domain status maps to exactly one color
 * meaning across the whole app (green = confirmed/present/paid, amber =
 * pending/late, red = absent/overdue, indigo = informational).
 */
const STATUS_MAP: Record<string, { variant: BadgeVariant; i18nKey: string }> = {
  // Attendance
  present: { variant: 'success', i18nKey: 'attendance.present' },
  absent: { variant: 'danger', i18nKey: 'attendance.absent' },
  late: { variant: 'warning', i18nKey: 'attendance.late' },
  excused: { variant: 'info', i18nKey: 'attendance.excused' },
  // Tickets
  open: { variant: 'info', i18nKey: 'tickets.status_open' },
  in_progress: { variant: 'warning', i18nKey: 'tickets.status_in_progress' },
  resolved: { variant: 'success', i18nKey: 'tickets.status_resolved' },
  closed: { variant: 'default', i18nKey: 'tickets.status_closed' },
  // Invoices
  paid: { variant: 'success', i18nKey: 'invoices.paid' },
  pending: { variant: 'warning', i18nKey: 'invoices.pending' },
  overdue: { variant: 'danger', i18nKey: 'invoices.overdue' },
  // Sessions
  scheduled: { variant: 'info', i18nKey: 'session.scheduled' },
  completed: { variant: 'success', i18nKey: 'session.completed' },
  cancelled: { variant: 'danger', i18nKey: 'session.cancelled' },
  // Cards (active/expired/revoked) — same color meaning as everywhere else
  card_active: { variant: 'success', i18nKey: 'status.card_active' },
  card_expired: { variant: 'default', i18nKey: 'status.card_expired' },
  card_revoked: { variant: 'danger', i18nKey: 'status.card_revoked' },
  // Billing override (temporary grace granted by the teacher)
  billing_override_active: { variant: 'info', i18nKey: 'status.billing_override_active' },
  // Attendance check-in method (transparency — how a day was recorded)
  card_scan: { variant: 'success', i18nKey: 'status.method_card_scan' },
  phone_permitted: { variant: 'warning', i18nKey: 'status.method_phone' },
  manual: { variant: 'default', i18nKey: 'status.method_manual' },
  // Session-swap / discrepancy resolution outcomes
  permanent: { variant: 'info', i18nKey: 'status.discrepancy_permanent' },
  one_time: { variant: 'default', i18nKey: 'status.discrepancy_one_time' },
  via_swap: { variant: 'info', i18nKey: 'status.via_swap' },
  // Incident report — deliberately calm/informational, never alarming: a parent
  // must be able to read the content before forming a reaction. Indigo (info) +
  // neutral gray only; no amber/red, and Badge renders no icons (no warning glyphs).
  report_approved: { variant: 'info', i18nKey: 'status.report_approved' },
  report_pending: { variant: 'default', i18nKey: 'status.report_pending' },
  report_rejected: { variant: 'default', i18nKey: 'status.report_rejected' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { t } = useTranslation();
  const entry = STATUS_MAP[status];

  if (!entry) {
    return <Badge label={status} variant="default" size={size} />;
  }
  return <Badge label={t(entry.i18nKey)} variant={entry.variant} size={size} />;
}
