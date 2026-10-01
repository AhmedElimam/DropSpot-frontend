/**
 * Clearing the query cache across an impersonation boundary (src/utils/sessionCache.ts).
 * The founder's teacher home sat on «حصص اليوم» spinner until pull-to-refresh: the cache was
 * cleared one tick after the new screens mounted, stranding their in-flight queries.
 */
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { clearForSessionSwitch, purgeUnobserved } from '../sessionCache';

const never = () => new Promise<string>(() => {});

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

describe('cache across a session switch', () => {
  it('shows the bug being avoided: a mounted query cleared mid-flight never resolves', async () => {
    const qc = client();
    const observer = new QueryObserver(qc, { queryKey: ['teacher-sessions-today'], queryFn: never });
    const unsubscribe = observer.subscribe(() => {});

    qc.clear(); // what the watcher used to do AFTER the screen had mounted
    await Promise.resolve();

    const result = observer.getCurrentResult();
    expect(result.status).toBe('pending');
    // Its query is gone from the cache, so nothing will ever deliver data to it.
    expect(qc.getQueryCache().find({ queryKey: ['teacher-sessions-today'] })).toBeUndefined();
    unsubscribe();
  });

  it('a query created AFTER the clear is untouched and resolves', async () => {
    jest.useFakeTimers();
    const qc = client();
    // The old screen's data (nobody is watching it any more once it unmounts).
    qc.setQueryData(['students', 1], ['old teacher data']);

    const cancel = clearForSessionSwitch(qc);
    // The new screen mounts after the clear and starts its own request.
    const observer = new QueryObserver(qc, { queryKey: ['teacher-sessions-today'], queryFn: async () => ['today'] });
    const unsubscribe = observer.subscribe(() => {});

    await jest.advanceTimersByTimeAsync(10);
    expect(observer.getCurrentResult().data).toEqual(['today']);
    expect(qc.getQueryData(['students', 1])).toBeUndefined();

    // The sweeps never touch an observed query.
    await jest.advanceTimersByTimeAsync(3000);
    expect(observer.getCurrentResult().data).toEqual(['today']);
    unsubscribe();
    cancel();
    jest.useRealTimers();
  });

  it('the sweep removes only what nobody observes — the old screen that re-fetched before unmounting', () => {
    const qc = client();
    qc.setQueryData(['teacher-sessions-today'], ['previous person']); // polluted after the clear, now unobserved
    const live = new QueryObserver(qc, { queryKey: ['notifications', 'unread-count'], queryFn: async () => 3 });
    const unsubscribe = live.subscribe(() => {});

    expect(purgeUnobserved(qc)).toBe(1);
    expect(qc.getQueryData(['teacher-sessions-today'])).toBeUndefined();
    expect(qc.getQueryCache().find({ queryKey: ['notifications', 'unread-count'] })).toBeDefined();
    unsubscribe();
  });
});
