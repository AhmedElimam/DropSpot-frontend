import { AxiosError } from 'axios';

/**
 * A hard ceiling on a request that the transport's own timeout does not reliably give.
 *
 * axios's `timeout` is applied by React Native's networking layer as OkHttp read/connect
 * timeouts — and neither covers DNS resolution. On Wi-Fi with a dead resolver (a captive
 * portal, a router whose DNS is down: seen on the emulator 2026-09-28), the login request
 * hung for well over a minute with the button stuck on «جاري تسجيل الدخول…», which a teacher
 * reads as "the app doesn't log in any more". This races the request against a timer and
 * rejects with the same shape axios uses for its own timeouts (`ECONNABORTED`), so
 * getFriendlyErrorMessage shows the existing «استغرق الاتصال وقتاً طويلاً» message.
 */
export const LOGIN_TIMEOUT_MS = 25_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, what = 'request'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AxiosError(`${what} timed out after ${ms} ms`, AxiosError.ECONNABORTED)), ms);
  });

  return Promise.race([promise, ceiling]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}
