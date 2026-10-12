/** The audio mode is switched once and only when it must change (founder 2026-10-12: «a delay on voice note»). */
const mockSet = jest.fn(async () => undefined);
jest.mock('expo-audio', () => ({ setAudioModeAsync: (...a: unknown[]) => mockSet(...(a as [])) }));

import { audioModeIs, ensureAudioMode, resetAudioModeForTests } from '../audioMode';

describe('ensureAudioMode', () => {
  beforeEach(() => { mockSet.mockClear(); resetAudioModeForTests(); });

  it('switches once; asking again for the same mode costs nothing', async () => {
    await ensureAudioMode('playback');
    await ensureAudioMode('playback');
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(audioModeIs('playback')).toBe(true);
  });

  it('concurrent asks for one mode share one switch; a different mode switches again', async () => {
    await Promise.all([ensureAudioMode('record'), ensureAudioMode('record'), ensureAudioMode('record')]);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenLastCalledWith({ allowsRecording: true, playsInSilentMode: true });
    await ensureAudioMode('playback');
    expect(mockSet).toHaveBeenLastCalledWith({ allowsRecording: false, playsInSilentMode: true });
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it('a failed switch is retried on the next ask', async () => {
    mockSet.mockRejectedValueOnce(new Error('busy'));
    await ensureAudioMode('playback');
    expect(audioModeIs('playback')).toBe(false);
    await ensureAudioMode('playback');
    expect(audioModeIs('playback')).toBe(true);
  });
});
