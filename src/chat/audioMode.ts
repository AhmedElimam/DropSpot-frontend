import { setAudioModeAsync } from 'expo-audio';

/**
 * The phone's audio mode, switched once and only when it must change.
 *
 * iOS has two modes this room uses: PLAYBACK (voice notes out of the loudspeaker, even with the
 * silent switch on) and RECORD (the microphone open — which also routes sound to the earpiece,
 * so it must never stay on while a note plays). Every voice note used to set the mode when it
 * appeared on screen, and the recorder switched back and forth around every take; each switch
 * reconfigures the audio session, and a play or a record that lands during one waits for it
 * (founder 2026-10-12: «there's a delay on voice note»).
 *
 * Here the mode is remembered: asking for the mode already set costs nothing, and concurrent
 * asks share one switch.
 */
export type AudioModeName = 'playback' | 'record';

let current: AudioModeName | null = null;
let switching: Promise<void> | null = null;
let target: AudioModeName | null = null;

export function audioModeIs(mode: AudioModeName): boolean {
  return current === mode && !switching;
}

export function ensureAudioMode(mode: AudioModeName): Promise<void> {
  if (current === mode && !switching) return Promise.resolve();
  if (switching && target === mode) return switching;
  target = mode;
  const token = { done: false };
  const run: Promise<void> = (async () => {
    try {
      await setAudioModeAsync(mode === 'record'
        ? { allowsRecording: true, playsInSilentMode: true }
        : { allowsRecording: false, playsInSilentMode: true });
      current = mode;
    } catch {
      current = null; // unknown: the next ask switches again
    } finally {
      token.done = true;
      if (target === mode) { switching = null; target = null; }
    }
  })();
  if (!token.done) switching = run;
  return run;
}

/** Tests only. */
export function resetAudioModeForTests(): void {
  current = null; switching = null; target = null;
}
