import { useCallback, useEffect, useRef } from 'react';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';

/**
 * الناظر's unlock sound (founder 2026-10-23: «the sound and everything» in the popup, and the
 * sound changeable without waiting for an app update): the latch giving at 0 s, the chime at
 * CHIME_AT, when he bursts in. It is the SAME file the website plays, served from drosspot.app —
 * replace public/sounds/nazer-unlock.m4a in the backend and every phone has the new sound,
 * no store build and no OTA. It stays off the app bundle (the Android asset budget is full).
 *
 * Played through expo-video, which every store build already carries (the tutorials), so this
 * needs no new native module. It mixes with whatever else is playing, and it is fetched when
 * the popup opens, before the tap. No network, no sound — the show goes on without it.
 */
const SOUND_URL = 'https://drosspot.app/sounds/nazer-unlock.m4a';
export const CHIME_AT = 0.82;

export function useUnlockSound(active: boolean) {
  const player = useRef<VideoPlayer | null>(null);

  useEffect(() => {
    if (!active) return;
    let p: VideoPlayer | null = null;
    try {
      p = createVideoPlayer({ uri: SOUND_URL });
      p.audioMixingMode = 'mixWithOthers';
      p.loop = false;
      player.current = p;
    } catch {
      p = null;
    }
    return () => {
      player.current = null;
      try { p?.release(); } catch { /* already gone */ }
    };
  }, [active]);

  /** Plays from `from` seconds: 0 at the crack, CHIME_AT when the crack was skipped. */
  return useCallback((from = 0) => {
    const p = player.current;
    if (!p) return;
    try {
      p.currentTime = from;
      p.play();
    } catch { /* no sound */ }
  }, []);
}
