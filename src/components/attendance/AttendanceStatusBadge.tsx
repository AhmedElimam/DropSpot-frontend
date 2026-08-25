import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus } from '@/types/attendance';

interface AttendanceStatusBadgeProps {
  // Accept any string: a backend-driven config world can send a status this build
  // wasn't compiled against, so never assume the value is in the union.
  status: AttendanceStatus | string;
}

const statusConfig: Record<AttendanceStatus, { variant: BadgeVariant; labelKey: string }> = {
  present: { variant: 'success', labelKey: 'attendance.present' },
  absent: { variant: 'danger', labelKey: 'attendance.absent' },
  late: { variant: 'warning', labelKey: 'attendance.late' },
  excused: { variant: 'info', labelKey: 'attendance.excused' },
};

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status as AttendanceStatus];

  // Unknown status → a neutral grey badge showing the raw string. Never index
  // into `undefined` (which blanked/crashed the row before).
  if (!config) return <Badge label={String(status ?? '—')} variant="default" />;

  return <Badge label={t(config.labelKey)} variant={config.variant} />;
}
