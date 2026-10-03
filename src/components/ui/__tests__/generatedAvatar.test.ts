import { avatarFeatures } from '../GeneratedAvatar';

/**
 * The generated face (founder 2026-10-03: no more initials). The same seed must always
 * give the same face — a person keeps theirs across screens and sessions — and different
 * seeds must give visibly different faces.
 */
describe('avatarFeatures', () => {
  it('is deterministic for a seed', () => {
    expect(avatarFeatures('student-42')).toEqual(avatarFeatures('student-42'));
    expect(avatarFeatures('أحمد محمد')).toEqual(avatarFeatures('أحمد محمد'));
  });

  it('varies across seeds', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `teacher-${i}`);
    const keys = new Set(seeds.map((s) => JSON.stringify(avatarFeatures(s))));
    expect(keys.size).toBeGreaterThan(30);
    const colours = new Set(seeds.map((s) => avatarFeatures(s).wrapperColor));
    expect(colours.size).toBeGreaterThan(3);
  });

  it('never paints the body in the backdrop colour and keeps the face readable', () => {
    for (let i = 0; i < 200; i++) {
      const f = avatarFeatures(`seed-${i}`);
      expect(f.wrapperColor).not.toBe(f.backgroundColor);
      expect(['#1A2140', '#FFFFFF']).toContain(f.faceColor);
      expect(f.wrapperScale).toBeGreaterThanOrEqual(1);
      expect(Math.abs(f.eyeSpread)).toBeLessThan(5);
    }
  });

  it('copes with an empty seed', () => {
    expect(() => avatarFeatures('')).not.toThrow();
  });
});
