import { dark, light, gradientSets, type Palette } from '../palettes';
import { applyScheme, colors, currentScheme, gradients, shadows, textPresets } from '../index';

/**
 * The two palettes (founder 2026-10-03: a loved light theme, and a dark one that is navy
 * with neon, not black). Same keys in both; every text/background pair the screens rely on
 * keeps its contrast in both; the dark canvas is blue, not black.
 */
type RGB = [number, number, number];

function parse(c: string): { rgb: RGB; a: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], a: +rgba[4] };
  throw new Error(`unparseable colour ${c}`);
}

/** `fg` composited over `bg` (both may be translucent; `base` is the opaque canvas under them). */
function over(top: string, under: RGB): RGB {
  const { rgb, a } = parse(top);
  return rgb.map((v, i) => Math.round(v * a + under[i] * (1 - a))) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string, canvas: string): number {
  const base = over(bg, over(canvas, [0, 0, 0]));
  const top = over(fg, base);
  const [l1, l2] = [luminance(top), luminance(base)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const PAIRS: [keyof Palette | 'white', keyof Palette, number][] = [
  ['textPrimary', 'background', 7],
  ['textPrimary', 'surface', 7],
  ['textSecondary', 'surface', 4.5],
  ['textTertiary', 'surface', 3],
  ['onPrimary', 'primary', 4.5],
  ['white', 'danger', 4.5],
  ['white', 'info', 4.5],
  ['white', 'success', 3],
  ['onAccent', 'accent', 4.5],
  ['successText', 'successLight', 4.5],
  ['warningText', 'warningLight', 4.5],
  ['dangerText', 'dangerLight', 4.5],
  ['infoText', 'infoLight', 4.5],
  ['brand', 'surface', 3],
  ['tabActive', 'tabBar', 3],
  ['tabInactive', 'tabBar', 3],
];

describe.each([['light', light], ['dark', dark]] as const)('%s palette', (name, p) => {
  it('has every token, each a parseable colour', () => {
    expect(Object.keys(p).sort()).toEqual(Object.keys(name === 'light' ? dark : light).sort());
    for (const [k, v] of Object.entries(p)) expect(() => parse(v)).not.toThrow();
    for (const k of Object.keys(p)) expect(typeof p[k as keyof Palette]).toBe('string');
  });

  it.each(PAIRS)('%s on %s reads (≥ %s)', (fg, bg, min) => {
    const ratio = contrast(fg === 'white' ? '#FFFFFF' : p[fg], p[bg], p.background);
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  it('the hero text reads on every stop of the hero gradient', () => {
    for (const stop of gradientSets[name].hero) {
      expect(contrast(p.onHero, stop, stop)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onHeroSoft, stop, stop)).toBeGreaterThanOrEqual(3);
    }
  });

  it('the auth screens stay deep ink with white text', () => {
    for (const stop of gradientSets[name].auth) expect(contrast('#FFFFFF', stop, stop)).toBeGreaterThanOrEqual(7);
  });
});

describe('the dark palette is navy, not black', () => {
  it.each(['background', 'surface', 'surfaceSunken', 'tabBar'] as const)('%s is a blue', (k) => {
    const [r, g, b] = parse(dark[k]).rgb;
    expect(b).toBeGreaterThan(r + 12);
    expect(b).toBeGreaterThan(g + 8);
    expect(luminance([r, g, b])).toBeGreaterThan(0.004);
  });

  it('the neon signature is bright', () => {
    expect(luminance(parse(dark.neon).rgb)).toBeGreaterThan(0.5);
  });
});

describe('the light palette is a tinted canvas, not white', () => {
  it('background is off-white and cooler than paper', () => {
    expect(light.background.toUpperCase()).not.toBe('#FFFFFF');
    const [r, , b] = parse(light.background).rgb;
    expect(b).toBeGreaterThan(r);
  });
});

describe('live tokens', () => {
  afterEach(() => applyScheme('light'));

  it('applyScheme rewrites colors and gradients in place and reports a change', () => {
    expect(currentScheme()).toBe('light');
    expect(applyScheme('dark')).toBe(true);
    expect(colors.background).toBe(dark.background);
    expect(gradients.hero).toEqual(gradientSets.dark.hero);
    expect(applyScheme('dark')).toBe(false);
    expect(applyScheme('light')).toBe(true);
    expect(colors.background).toBe(light.background);
  });

  it('shadows and text presets follow the scheme instead of the import', () => {
    const dayShadow = shadows.md.shadowColor;
    const dayInk = textPresets.body.color;
    applyScheme('dark');
    expect(shadows.md.shadowColor).toBe(dark.shadow);
    expect(shadows.md.shadowColor).not.toBe(dayShadow);
    expect(textPresets.body.color).toBe(dark.textPrimary);
    expect(textPresets.body.color).not.toBe(dayInk);
    expect(shadows.glow.shadowColor).toBe(dark.neon);
    // spreading a getter preset still yields a plain style
    expect({ ...textPresets.caption }).toMatchObject({ fontSize: 13, color: dark.textTertiary });
  });
});
