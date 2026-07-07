import { isAxiosError } from 'axios';
import i18n from '@/i18n';

/**
 * Maps any thrown error to a calm, human Arabic sentence.
 * Parents must never see raw server strings, stack traces, or "Error 500".
 */
export function getFriendlyErrorMessage(error: unknown): string {
  const t = i18n.t.bind(i18n);

  if (isAxiosError(error)) {
    if (!error.response) {
      // No response at all: offline or timeout
      if (error.code === 'ECONNABORTED') return t('errors.timeout');
      return t('errors.network');
    }
    const status = error.response.status;
    if (status === 401) return t('errors.session_expired');
    if (status === 403) return t('errors.forbidden');
    if (status === 404) return t('errors.not_found_generic');
    if (status === 422) {
      // Validation problems are the one case where the server message helps,
      // but only if it exists; still never fall through to raw JSON.
      const msg = error.response.data?.message;
      if (typeof msg === 'string' && msg.length < 140) return msg;
      return t('errors.validation_error');
    }
    if (status >= 500) return t('errors.server_error_friendly');
  }
  return t('errors.generic_friendly');
}
