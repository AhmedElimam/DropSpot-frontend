import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getReleaseNotes } from '@/api/releaseNotes';
import { useAuthStore } from '@/stores/authStore';

const CARD_KEY = 'whats_new_seen_version';
const POPUP_KEY = 'whats_new_popup_version';
const ROLES = new Set(['teacher', 'assistant', 'parent', 'student']);

export function useReleaseNotes() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  return useQuery({
    queryKey: ['release-notes', role],
    queryFn: getReleaseNotes,
    staleTime: 60 * 60 * 1000,
    // Mounted at the root for the popup: never ask before login, or for an admin.
    enabled: isAuthenticated && !!role && ROLES.has(role),
  });
}

/**
 * Which version's popup and card this phone has already closed. One store, so closing the
 * popup is seen by the card and the other way round. `undefined` = still reading storage:
 * nothing shows until then, so a closed note never flashes.
 */
const useSeen = create<{
  card: string | null | undefined;
  popup: string | null | undefined;
  hydrate: () => void;
  mark: (which: 'card' | 'popup', version: string) => void;
}>((set, get) => ({
  card: undefined,
  popup: undefined,
  hydrate: () => {
    if (get().card !== undefined) return;
    Promise.all([AsyncStorage.getItem(CARD_KEY), AsyncStorage.getItem(POPUP_KEY)])
      .then(([card, popup]) => set({ card, popup }))
      .catch(() => set({ card: null, popup: null }));
  },
  mark: (which, version) => {
    set({ [which]: version } as never);
    AsyncStorage.setItem(which === 'card' ? CARD_KEY : POPUP_KEY, version).catch(() => {});
  },
}));

/**
 * The note for the version installed on THIS phone. The popup shows once per version; the
 * home card stays until closed. Closing the popup ("حسنًا") closes both, since the user has
 * read it; closing only the card leaves the popup already done. A note published later for
 * the same version still appears — the check runs on every visit, not only at update.
 */
export function useWhatsNew() {
  const { data } = useReleaseNotes();
  const installed = Constants.expoConfig?.version ?? '';
  const { card, popup, hydrate, mark } = useSeen();
  useEffect(() => { hydrate(); }, [hydrate]);

  const note = (data ?? []).find((n) => n.version === installed && n.lines.length > 0) ?? null;
  const ready = card !== undefined && popup !== undefined;

  const dismissCard = useCallback(() => mark('card', installed), [mark, installed]);
  const dismissPopup = useCallback(() => {
    mark('popup', installed);
    mark('card', installed);
  }, [mark, installed]);

  return {
    note,
    showCard: ready && !!note && card !== installed,
    showPopup: ready && !!note && popup !== installed,
    dismissCard,
    dismissPopup,
    /** Close the popup but keep the card on the home screen (e.g. "عرض كل التحديثات"). */
    popupDone: useCallback(() => mark('popup', installed), [mark, installed]),
  };
}
