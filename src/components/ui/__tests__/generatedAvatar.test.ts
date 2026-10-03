import { AVATAR_CHARACTERS, avatarFeatures, avatarSeed } from '../GeneratedAvatar';

/**
 * The generated character (founder 2026-10-03: no initials; «robot, carrot, fruits,
 * animals»). The same seed must always give the same character on the same backdrop — a
 * person keeps theirs across screens and sessions — and a roster must not look like one
 * character repeated.
 */
describe('avatarFeatures', () => {
  it('is deterministic for a seed', () => {
    expect(avatarFeatures('student-42')).toEqual(avatarFeatures('student-42'));
    expect(avatarFeatures('أحمد محمد')).toEqual(avatarFeatures('أحمد محمد'));
  });

  it('has a wide cast and spreads a class over most of it, several backdrops and every expression', () => {
    expect(AVATAR_CHARACTERS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(AVATAR_CHARACTERS).size).toBe(AVATAR_CHARACTERS.length);
    const seeds = Array.from({ length: 120 }, (_, i) => avatarSeed.student(i));
    const characters = new Set(seeds.map((s) => avatarFeatures(s).character));
    expect(characters.size).toBeGreaterThanOrEqual(34);
    const backdrops = new Set(seeds.map((s) => avatarFeatures(s).backgroundColor));
    expect(backdrops.size).toBeGreaterThanOrEqual(6);
    const expressions = new Set(seeds.map((s) => avatarFeatures(s).expression));
    expect(expressions.size).toBe(5);
    const combos = new Set(seeds.map((s) => JSON.stringify(avatarFeatures(s))));
    expect(combos.size).toBeGreaterThan(110);
  });

  it('never puts a character on a backdrop it would vanish against', () => {
    const clashes: Record<string, string[]> = {
      carrot: ['#E7913A', '#E9655C', '#D97B22'],
      apple: ['#E7913A', '#E9655C', '#D97B22'],
      strawberry: ['#E7913A', '#E9655C', '#D97B22'],
      fox: ['#E7913A', '#E9655C', '#D97B22'],
      frog: ['#1F9366'],
      cactus: ['#1F9366'],
      whale: ['#34419B', '#4A57B5', '#2A9DB0'],
      octopus: ['#E7913A', '#E9655C', '#D97B22'],
      sun: ['#E7913A', '#C9A227', '#D97B22'],
      banana: ['#E7913A', '#C9A227', '#D97B22'],
      bee: ['#C9A227'],
      chick: ['#E7913A', '#C9A227'],
    };
    for (let i = 0; i < 400; i++) {
      const f = avatarFeatures(`seed-${i}`);
      expect(clashes[f.character] ?? []).not.toContain(f.backgroundColor);
      expect(clashes[f.character] ?? []).not.toContain(f.wrapperColor);
    }
  });

  it('tilts a second-colour blob behind the character and leans the character a little', () => {
    const seeds = Array.from({ length: 80 }, (_, i) => avatarSeed.user(i));
    for (const s of seeds) {
      const f = avatarFeatures(s);
      expect(f.wrapperColor).not.toBe(f.backgroundColor);
      expect(Math.abs(f.wrapperTranslateX)).toBeGreaterThanOrEqual(6);
      expect(Math.abs(f.wrapperTranslateY)).toBeGreaterThanOrEqual(6);
      expect(f.wrapperScale).toBeGreaterThanOrEqual(1);
      expect(Math.abs(f.tilt)).toBeLessThanOrEqual(12);
    }
    expect(new Set(seeds.map((s) => avatarFeatures(s).wrapperRotate)).size).toBeGreaterThan(8);
    expect(new Set(seeds.map((s) => avatarFeatures(s).tilt)).size).toBeGreaterThan(4);
  });

  it('copes with an empty seed', () => {
    expect(() => avatarFeatures('')).not.toThrow();
  });
});

describe('avatarSeed', () => {
  it('namespaces ids so a student and a user with the same number never collide', () => {
    expect(avatarSeed.student(7)).toBe('student-7');
    expect(avatarSeed.user(7)).toBe('user-7');
    expect(avatarSeed.student('7')).toBe(avatarSeed.student(7));
  });

  it('falls back when there is no id yet', () => {
    expect(avatarSeed.student(null)).toBe('?');
    expect(avatarSeed.user(undefined, 'أحمد')).toBe('أحمد');
    expect(avatarSeed.user('')).toBe('?');
  });
});
