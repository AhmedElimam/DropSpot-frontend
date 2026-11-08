import { useCallback, useEffect, useRef } from 'react';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import type { ScanResult, ScanPending } from '@/api/teacher';

/**
 * The door's three sounds (founder 2026-11-08): «all clear, go in», «has money to pay», and
 * «missed the last session without an excuse». A last absence WITH an excuse sounds like all clear.
 *
 * Same approach as الناظر's unlock sound (src/components/nazer/unlockSound.ts): the files live on
 * drosspot.app (public/sounds in the backend), so a sound can be swapped with no store build and
 * no OTA, and they cost nothing in the Android asset budget. Played through expo-video, which
 * every store build already carries. Loaded while the scan screen is open; no network, no sound —
 * the vibration still says yes or no.
 */
export type DoorTone = 'clear' | 'bill' | 'absent';

const BASE = 'https://drosspot.app/sounds/door-';
const TONES: DoorTone[] = ['clear', 'bill', 'absent'];

function owes(p?: ScanPending | null): boolean {
  return !!p && (!!p.bill || (p.booklets?.length ?? 0) > 0 || !!p.booking);
}

/** The server's choice (DoorToneService), or the same rule from the dues for an older backend. */
export function doorToneFor(res: ScanResult): DoorTone | null {
  if (res.door_tone) return res.door_tone;
  if (!res.success) return res.code === 'BILLING_OVERDUE' ? 'bill' : null;
  return owes(res.pending) ? 'bill' : 'clear';
}

export function useDoorTones(active: boolean) {
  const players = useRef<Partial<Record<DoorTone, VideoPlayer>>>({});

  useEffect(() => {
    if (!active) return;
    const made: Partial<Record<DoorTone, VideoPlayer>> = {};
    for (const tone of TONES) {
      try {
        const p = createVideoPlayer({ uri: `${BASE}${tone}.m4a` });
        p.audioMixingMode = 'mixWithOthers';
        p.loop = false;
        p.volume = 1;
        made[tone] = p;
      } catch { /* no sound for this one */ }
    }
    players.current = made;
    return () => {
      players.current = {};
      for (const p of Object.values(made)) {
        try { p?.release(); } catch { /* already gone */ }
      }
    };
  }, [active]);

  return useCallback((tone: DoorTone | null) => {
    if (!tone) return;
    const p = players.current[tone];
    if (!p) return;
    try {
      p.currentTime = 0;
      p.play();
    } catch { /* no sound */ }
  }, []);
}
