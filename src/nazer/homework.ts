import type { HomeworkSummary } from '@/api/homework';
import { formatNumber } from '@/utils/format';

type T = (key: string, opts?: Record<string, unknown>) => string;

/**
 * الناظر's one line about homework on his desk: the completion rate and the three counts,
 * toned by the rate. Null when no homework was ever given (nothing to open).
 */
export function homeworkNote(summary: HomeworkSummary | null | undefined, given: number, t: T): {
  tone: 'success' | 'info' | 'warning';
  title: string;
  sub: string | undefined;
} | null {
  if (!summary || (summary.graded === 0 && given === 0)) return null;
  const rate = summary.rate;
  return {
    tone: rate == null ? 'info' : rate >= 80 ? 'success' : rate >= 50 ? 'info' : 'warning',
    title: rate == null ? t('homework.nazer_title_none') : t('homework.nazer_title', { rate: formatNumber(rate) }),
    sub: summary.graded > 0
      ? [
        `${t('homework.rating.done')} ${formatNumber(summary.done)}`,
        `${t('homework.rating.partial')} ${formatNumber(summary.partial)}`,
        `${t('homework.rating.missing')} ${formatNumber(summary.missing)}`,
      ].join(' · ')
      : undefined,
  };
}
