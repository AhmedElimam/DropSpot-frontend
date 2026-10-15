/**
 * The room's voice notes, as one small choir with one rule: one sings at a time, and when a
 * note ends the next unheard one below it starts — a run of voice notes plays through like
 * a conversation, hands off, the way WhatsApp does it (founder, 2026-09-20).
 *
 * Module-level on purpose: bubbles mount and unmount as the list scrolls, and none of them
 * should have to know about the others. A bubble registers itself by message id (which is
 * also the room order), and unregisters when it leaves the screen.
 */
type Entry = { play: () => void; pause: () => void; played: () => boolean };

const notes = new Map<number, Entry>();

/** Playback speed, remembered for the session like WhatsApp: pick 1.5× once and every note plays at 1.5×. */
export const VOICE_RATES = [1, 1.5, 2] as const;
let rate: number = 1;
const rateListeners = new Set<(r: number) => void>();

export function registerVoiceNote(id: number, entry: Entry): () => void {
  notes.set(id, entry);
  return () => { notes.delete(id); };
}

/** Called by the note that is about to play: every other note falls silent. */
export function claimVoicePlayback(id: number): void {
  notes.forEach((e, k) => { if (k !== id) e.pause(); });
}

/** Called by a note that just finished: start the next unheard note below it, if any. */
export function playNextVoiceAfter(id: number): boolean {
  const next = [...notes.keys()].filter((k) => k > id).sort((a, b) => a - b).find((k) => !notes.get(k)!.played());
  if (next === undefined) return false;
  notes.get(next)!.play();
  return true;
}

export function getVoiceRate(): number { return rate; }

export function cycleVoiceRate(): number {
  rate = VOICE_RATES[(VOICE_RATES.indexOf(rate as typeof VOICE_RATES[number]) + 1) % VOICE_RATES.length];
  rateListeners.forEach((l) => l(rate));
  return rate;
}

export function onVoiceRate(listener: (r: number) => void): () => void {
  rateListeners.add(listener);
  return () => { rateListeners.delete(listener); };
}

/** Test seam. */
export function _resetVoiceQueue(): void { notes.clear(); rate = 1; rateListeners.clear(); }
