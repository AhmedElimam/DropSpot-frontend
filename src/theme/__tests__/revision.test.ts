import { light, dark, gradientSets, palettes, type Palette } from '../palettes';
import { revisionOverlay, revisionGradients, REVISION_INK } from '../revision';
import { applyScheme, colors, gradients, isRevisionTheme, setRevisionTheme, setThemeOverrides } from '../index';

/**
 * «وضع المراجعة» is a LAYER, not a scheme: off, every token is the palette's own (the
 * founder's rule — nothing changes when the season is off); on, the indigo + amber family
 * is laid over whichever scheme is live, and every text/background pair the screens rely on
 * keeps its contrast.
 */
type RGB = [number, number, number];
function parse(c: string): { rgb: RGB; a: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) { const n = parseInt(hex[1], 16); return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 }; }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], a: +rgba[4] };
  throw new Error(`unparseable colour ${c}`);
}
function over(top: string, under: RGB): RGB { const { rgb, a } = parse(top); return rgb.map((v, i) => Math.round(v * a + under[i] * (1 - a))) as RGB; }
function lum([r, g, b]: RGB): number { const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
function contrast(fg: string, bg: string, canvas: string): number {
  const base = over(bg, over(canvas, [0, 0, 0]));
  const [l1, l2] = [lum(over(fg, base)), lum(base)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const overlaid = (scheme: 'light' | 'dark'): Palette => ({ ...palettes[scheme], ...revisionOverlay[scheme] });

afterEach(() => { setRevisionTheme(false); setThemeOverrides(undefined); applyScheme('light'); });

describe('the overlay only names real tokens', () => {
  it.each(['light', 'dark'] as const)('%s', (scheme) => {
    for (const key of Object.keys(revisionOverlay[scheme])) expect(key in light).toBe(true);
    for (const key of Object.keys(revisionGradients[scheme])) expect(key in gradientSets.light).toBe(true);
  });
});

describe('contrast with the season on', () => {
  const PAIRS: [keyof Palette, keyof Palette, number][] = [
    ['onPrimary', 'primary', 4.5],
    ['infoText', 'infoLight', 4.5],
    ['brand', 'surface', 3],
    ['tabActive', 'tabBar', 3],
    ['textPrimary', 'brandTint', 4.5],
    ['onHeroChipActive', 'heroChipActive', 2],
  ];
  it.each(['light', 'dark'] as const)('%s', (scheme) => {
    const p = overlaid(scheme);
    for (const [fg, bg, min] of PAIRS) {
      expect(contrast(p[fg], p[bg], p.background)).toBeGreaterThanOrEqual(min);
    }
    // White ink on every stop of the season's hero.
    for (const stop of revisionGradients[scheme].hero ?? []) expect(contrast('#FFFFFF', stop, stop)).toBeGreaterThanOrEqual(4.5);
  });
  it('is the web dashboard\'s revise family (one season on both platforms)', () => {
    expect(revisionOverlay.light.primary).toBe('#232C6B');
    expect(revisionOverlay.light.brandDeep).toBe('#1A2147');
    expect(revisionOverlay.light.brandTint).toBe('#E4E7F6');
    expect(REVISION_INK.amber).toBe('#E7913A');
    // Never violet: the hue stays on the indigo side (blue > red, clearly).
    for (const scheme of ['light', 'dark'] as const) {
      const [r, , b] = parse(overlaid(scheme).primary).rgb;
      expect(b).toBeGreaterThan(r * 1.5);
    }
  });
});

describe('the live tokens', () => {
  it('are untouched while the season is off — in both schemes', () => {
    applyScheme('light');
    expect({ ...colors }).toEqual(light);
    expect(gradients.hero).toEqual(gradientSets.light.hero);
    applyScheme('dark');
    expect({ ...colors }).toEqual(dark);
    expect(gradients.hero).toEqual(gradientSets.dark.hero);
  });

  it('take the overlay when on, follow a scheme change, and come back exactly', () => {
    applyScheme('light');
    expect(setRevisionTheme(true)).toBe(true);
    expect(isRevisionTheme()).toBe(true);
    expect(colors.primary).toBe(REVISION_INK.indigo);
    expect(colors.background).toBe(light.background); // never a wall
    expect(gradients.hero).toEqual(revisionGradients.light.hero);
    applyScheme('dark');
    expect(colors.primary).toBe(revisionOverlay.dark.primary);
    expect(colors.surface).toBe(dark.surface);
    expect(setRevisionTheme(true)).toBe(false); // idempotent
    expect(setRevisionTheme(false)).toBe(true);
    expect({ ...colors }).toEqual(dark);
    expect(gradients.hero).toEqual(gradientSets.dark.hero);
  });

  it('sits over a backend repaint, and lifts without disturbing it', () => {
    applyScheme('light');
    setThemeOverrides({ light: { accent: '#AA0000', primary: '#123456' } });
    setRevisionTheme(true);
    expect(colors.primary).toBe(REVISION_INK.indigo);
    expect(colors.accent).toBe('#AA0000');
    setRevisionTheme(false);
    expect(colors.primary).toBe('#123456');
    expect(colors.accent).toBe('#AA0000');
  });
});
