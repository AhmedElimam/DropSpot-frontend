import type { TFunction } from 'i18next';
import { Alert } from '@/ui/dialog';
import { sendRemovalSms, type RemovalSms } from '@/api/enrollments';
import { getFriendlyErrorMessage } from '@/utils/errors';

/**
 * The follow-up after a student is removed (founder 2026-10-30): ask whether to text the
 * family, showing the exact message and the numbers it goes to. Nothing is sent unless the
 * teacher presses «أرسل». No parent number on file → nothing to ask.
 */
export function askRemovalSms(t: TFunction, enrollmentId: number, sms: RemovalSms | null): void {
  if (!sms || sms.phones.length === 0) return;
  Alert.alert(
    t('removal_sms.title'),
    t('removal_sms.body', { message: sms.message, phones: sms.phones.join('، ') }),
    [
      { text: t('removal_sms.skip'), style: 'cancel' },
      {
        text: t('removal_sms.send'),
        onPress: async () => {
          try {
            await sendRemovalSms(enrollmentId);
            Alert.alert('', t('removal_sms.sent'));
          } catch (e) {
            Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
          }
        },
      },
    ],
  );
}
