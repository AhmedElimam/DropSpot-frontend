import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus } from '@/types/attendance';

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
}

const statusConfig: Record<AttendanceStatus, { variant: 'success' | 'danger' | 'warning' | 'info'; labelKey: string }> = {
  present: { variant: 'success', labelKey: 'attendance.present' },
  absent: { variant: 'danger', labelKey: 'attendance.absent' },
  late: { variant: 'warning', labelKey: 'attendance.late' },
  excused: { variant: 'info', labelKey: 'attendance.excused' },
};

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status];

  return <Badge label={t(config.labelKey)} variant={config.variant} />;
}
