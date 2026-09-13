import { useQuery } from '@tanstack/react-query';
import { getPhoneConfirmations } from '@/api/phoneConfirmations';

export const PHONE_CONFIRMATIONS_KEY = ['phone-confirmations'] as const;

/**
 * «أرقام تحتاج تأكيد» — the list, and the count behind the home-screen card.
 *
 * Open to the teacher and to every assistant (no ability gate): the server decides
 * what, if anything, the caller's tenant contains, and answers 403 to anyone with no
 * teacher context at all. A short staleTime keeps the home badge honest right after
 * a number is vouched for without turning the home screen into a poller.
 */
export function usePhoneConfirmations() {
  return useQuery({
    queryKey: PHONE_CONFIRMATIONS_KEY,
    queryFn: getPhoneConfirmations,
    staleTime: 30_000,
  });
}
