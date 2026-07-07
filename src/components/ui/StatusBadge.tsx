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
