import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getReleaseNotes } from '@/api/releaseNotes';

const SEEN_KEY = 'whats_new_seen_version';

export function useReleaseNotes() {
  return useQuery({ queryKey: ['release-notes'], queryFn: getReleaseNotes, staleTime: 60 * 60 * 1000 });
}

/**
 * The note for the version installed on THIS phone, until the user closes it. Closing is
 * remembered per version, so the next release shows again; a note published later for the
 * same version still appears (the check runs on every home visit, not only at update).
 */
export function useWhatsNew() {
  const { data } = useReleaseNotes();
  const installed = Constants.expoConfig?.version ?? '';
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((v) => setSeen(v)).catch(() => setSeen(null));
  }, []);

  const note = (data ?? []).find((n) => n.version === installed) ?? null;
  const dismiss = useCallback(() => {
    setSeen(installed);
    AsyncStorage.setItem(SEEN_KEY, installed).catch(() => {});
  }, [installed]);

  // `seen === undefined` = still reading storage: show nothing rather than flash a closed note.
  return { note: seen === undefined || seen === installed ? null : note, dismiss };
}
