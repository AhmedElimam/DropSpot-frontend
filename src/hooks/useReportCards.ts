import { useQuery } from '@tanstack/react-query';
import { getReportCards } from '@/api/reports';

export function useReportCards() {
  return useQuery({
    queryKey: ['report-cards'],
    queryFn: getReportCards,
  });
}
