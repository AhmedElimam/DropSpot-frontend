import { HOMEWORK_RATINGS, type HomeworkSummary } from '@/api/homework';
import { formatNumber } from '@/utils/format';

type T = (key: string, opts?: Record<string, unknown>) => string;

/**
 * الناظر's one line about homework on his desk: the completion rate and the four counts,
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
      ? HOMEWORK_RATINGS.map((r) => `${t(`homework.rating.${r}`)} ${formatNumber(summary[r] ?? 0)}`).join(' · ')
      : undefined,
  };
}
