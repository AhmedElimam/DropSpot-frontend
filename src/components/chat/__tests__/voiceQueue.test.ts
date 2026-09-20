/** One voice note at a time; when one ends the next unheard one below it starts. */
import { _resetVoiceQueue, claimVoicePlayback, cycleVoiceRate, getVoiceRate, onVoiceRate, playNextVoiceAfter, registerVoiceNote } from '../voiceQueue';

function note(played = false) {
  return { play: jest.fn(), pause: jest.fn(), played: () => played };
}

beforeEach(() => _resetVoiceQueue());

it('starting one note silences every other', () => {
  const a = note(); const b = note(); const c = note();
  registerVoiceNote(1, a); registerVoiceNote(2, b); registerVoiceNote(3, c);
  claimVoicePlayback(2);
  expect(a.pause).toHaveBeenCalled(); expect(c.pause).toHaveBeenCalled(); expect(b.pause).not.toHaveBeenCalled();
});

it('when a note ends, the next UNHEARD note below it plays — heard ones are skipped', () => {
  const a = note(); const heard = note(true); const c = note();
  registerVoiceNote(10, a); registerVoiceNote(11, heard); registerVoiceNote(12, c);
  expect(playNextVoiceAfter(10)).toBe(true);
  expect(heard.play).not.toHaveBeenCalled();
  expect(c.play).toHaveBeenCalled();
});

it('the last note in the room ends quietly', () => {
  registerVoiceNote(1, note());
  expect(playNextVoiceAfter(1)).toBe(false);
});

it('a bubble that scrolled away is no longer part of the run', () => {
  const off = registerVoiceNote(2, note());
  const c = note(); registerVoiceNote(3, c);
  off();
  expect(playNextVoiceAfter(1)).toBe(true);
  expect(c.play).toHaveBeenCalled();
});

it('speed cycles 1× → 1.5× → 2× → 1× and every listener hears it', () => {
  const seen: number[] = [];
  onVoiceRate((r) => seen.push(r));
  expect(getVoiceRate()).toBe(1);
  expect(cycleVoiceRate()).toBe(1.5);
  expect(cycleVoiceRate()).toBe(2);
  expect(cycleVoiceRate()).toBe(1);
  expect(seen).toEqual([1.5, 2, 1]);
});
