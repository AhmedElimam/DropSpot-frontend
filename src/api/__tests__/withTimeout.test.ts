import { AxiosError, isAxiosError } from 'axios';
import { withTimeout, LOGIN_TIMEOUT_MS } from '../withTimeout';
import { getFriendlyErrorMessage } from '@/utils/errors';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the request when it finishes in time', async () => {
    const p = withTimeout(Promise.resolve('ok'), 1000);
    await expect(p).resolves.toBe('ok');
  });

  it('rejects as an axios timeout when the request never answers (dead DNS, captive portal)', async () => {
    const never = new Promise<string>(() => {});
    const p = withTimeout(never, 1000, 'login');
    const caught = p.catch((e) => e);
    jest.advanceTimersByTime(1001);
    const err = await caught;
    expect(isAxiosError(err)).toBe(true);
    expect((err as AxiosError).code).toBe(AxiosError.ECONNABORTED);
    // …which the login screen already turns into the "took too long" message.
    expect(getFriendlyErrorMessage(err)).toBe('استغرق الاتصال وقتاً طويلاً. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.');
  });

  it('passes the request error through unchanged when it fails first', async () => {
    const p = withTimeout(Promise.reject(new Error('boom')), 1000);
    await expect(p).rejects.toThrow('boom');
  });

  it('gives login 25 seconds — under the 30 s the transport would take on a good day', () => {
    expect(LOGIN_TIMEOUT_MS).toBe(25_000);
  });
});
