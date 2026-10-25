import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSubscription } from '@/api/subscription';
import { useAuthStore } from '@/stores/authStore';

/**
 * Keeps the session's copy of the teacher's subscription current (founder 2026-10-25): the
 * home banner, the trial's corner tag, her status popup and the settings card read the login
 * payload, which a bill issued, a payment recorded or an exemption given since would leave
 * stale until the next login. Re-read when the app opens and when it returns to the
 * foreground (focusManager follows AppState), at most every two minutes; same query as the
 * subscription page, so they share one request. Teachers only — an assistant's shape is
 * their teachers' combined state, from the login. Renders nothing.
 */
export function SubscriptionSync() {
  const role = useAuthStore((s) => s.role);
  const authed = useAuthStore((s) => s.isAuthenticated);
  const setSubscription = useAuthStore((s) => s.setSubscription);
  const { data } = useQuery({
    queryKey: ['teacher', 'subscription'],
    queryFn: getSubscription,
    enabled: authed && role === 'teacher',
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true,
  });
  const state = data?.state ?? null;
  useEffect(() => {
    if (state && role === 'teacher') void setSubscription(state);
  }, [state, role, setSubscription]);
  return null;
}
