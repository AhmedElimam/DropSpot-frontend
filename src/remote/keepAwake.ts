import { useEffect } from 'react';

type KeepAwake = {
  activateKeepAwakeAsync: (tag?: string) => Promise<void>;
  deactivateKeepAwake: (tag?: string) => Promise<void>;
};

const TAG = 'remote-room';

/**
 * The screen stays on while a live class is on it (a teacher broadcasting with the phone on a
 * stand, a student watching a board for an hour) — and only then: released the moment the room
 * leaves the screen. Loaded lazily and guarded, like haptics: a build without the module simply
 * keeps the phone's own auto-lock.
 */
export function useRoomAwake(on: boolean): void {
  useEffect(() => {
    if (!on) return undefined;
    let mod: KeepAwake | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('expo-keep-awake') as KeepAwake;
      mod.activateKeepAwakeAsync(TAG).catch(() => {});
    } catch {
      mod = null;
    }
    return () => {
      try {
        mod?.deactivateKeepAwake(TAG).catch(() => {});
      } catch {
        // nothing was holding the screen
      }
    };
  }, [on]);
}
