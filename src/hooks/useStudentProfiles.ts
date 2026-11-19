import { useEffect } from 'react';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, resolveRole } from '@/stores/authStore';
import { getStudentProfiles, switchStudentProfile } from '@/api/studentProfiles';
import { rememberProfile } from '@/stores/profileChoice';
import { clearForSessionSwitch } from '@/utils/sessionCache';
import { ROUTE_BY_ROLE } from '@/utils/routes';
import { currentProfile, isSharedPhone, orderProfiles, phoneHolderId } from '@/utils/sharedProfiles';
import type { StudentProfileEntry } from '@/types/user';

/** The students on this phone, as the session carries them (phone holder first). */
export function useSharedProfiles() {
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const profiles = role === 'student' ? orderProfiles(user?.profiles) : [];

  return {
    profiles,
    shared: isSharedPhone(profiles),
    current: currentProfile(profiles, user?.id),
    holderId: phoneHolderId(profiles),
  };
}

/**
 * Fresh list from GET /student/profiles while the switcher is open — a brother linked at the
 * door after this sign-in shows up without signing in again. The session's copy follows it.
 * An older server without the endpoint just keeps the login's list.
 */
export function useRefreshSharedProfiles(enabled: boolean) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useAuthStore((s) => s.role);
  const q = useQuery({
    queryKey: ['student-profiles', userId],
    queryFn: getStudentProfiles,
    enabled: enabled && role === 'student' && userId != null,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!q.data) return;
    const { user, patchUser } = useAuthStore.getState();
    if (!user || JSON.stringify(user.profiles ?? []) === JSON.stringify(q.data)) return;
    void patchUser({ profiles: q.data });
  }, [q.data]);

  return q;
}

/**
 * Switch the phone to a sibling: the server answers like a login, the session is replaced
 * through the same path a login takes, and none of the previous student's cached data
 * survives (same clear as an impersonation boundary — src/utils/sessionCache.ts). The root
 * cover (`switching`) is the blocking loader meanwhile.
 */
export function useSwitchProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (target: StudentProfileEntry) => {
      const store = useAuthStore.getState();
      const holder = phoneHolderId(store.user?.profiles);
      useAuthStore.setState({ switching: true });
      try {
        const data = await switchStudentProfile(target.user_id);
        if (!data?.user || !data.tokens?.access_token) throw new Error('profile switch: no session in the answer');
        await store.setTokens(data.tokens.access_token, data.tokens.refresh_token);
        // Chosen: the router must not ask again.
        store.setProfilePickPending(false);
        await store.setSession(data.user, resolveRole(data.user));
        void rememberProfile(holder ?? phoneHolderId(data.user.profiles), data.user.id);
        // Clear FIRST, then navigate (the order SessionSwitchWatcher keeps, for the same reason).
        clearForSessionSwitch(qc);
        router.replace(ROUTE_BY_ROLE);
      } finally {
        useAuthStore.setState({ switching: false });
      }
    },
  });
}

/** «ده أنا» on the picker: no switch, just remember it and go home. */
export function continueAsCurrent(userId: number) {
  const store = useAuthStore.getState();
  void rememberProfile(phoneHolderId(store.user?.profiles), userId);
  store.setProfilePickPending(false);
  router.replace(ROUTE_BY_ROLE);
}
