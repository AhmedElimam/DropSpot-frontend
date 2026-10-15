import type { GradientSet, Palette, Scheme } from './palettes';

/**
 * «وضع المراجعة» — the revision season's overlay (founder 2026-10-16: «change our whole app UI
 * and theme on revision mode … be creative»). NOT a third scheme: a layer laid over Mist or
 * Midnight while the signed-in teacher's revise mode is on, so both platforms read as one
 * season — the web dashboard's revise theme is DEEP INDIGO #232C6B / #1A2147 / #141833 with an
 * AMBER accent #E7913A and the light #E4E7F6 («darker indigo accents, never walls, never violet»).
 *
 * What the overlay touches: the brand / primary / info family, the page hero (deep indigo in
 * both schemes — the web paints its hero the same way in revise mode), the tab bar's active
 * colour and the centre button's ring (amber), selection tints and the neon signature. What it
 * leaves alone: the canvas, surfaces, borders and body text — those stay the scheme's own, so
 * every card keeps its contrast and nothing turns into a wall.
 *
 * Every value here must pass the same contrast pairs as the palettes (src/theme/__tests__).
 */
export const REVISION_INK = {
  indigo: '#232C6B',
  indigoDeep: '#1A2147',
  indigoDeeper: '#141833',
  amber: '#E7913A',
  amberDeep: '#C9771F',
  light: '#E4E7F6',
  /** Chip text on the light indigo tint. */
  onLight: '#1A2147',
} as const;

export const revisionOverlay: Record<Scheme, Partial<Palette>> = {
  light: {
    primary: REVISION_INK.indigo,
    primaryLight: REVISION_INK.light,
    primaryDark: REVISION_INK.indigoDeeper,
    secondary: '#2A3480',
    secondaryLight: REVISION_INK.light,
    info: REVISION_INK.indigo,
    infoLight: REVISION_INK.light,
    infoText: REVISION_INK.onLight,
    brand: REVISION_INK.indigo,
    brandDeep: REVISION_INK.indigoDeep,
    brandTint: REVISION_INK.light,
    // The hero becomes the season's band: deep indigo with white ink (the day hero is paper).
    onHero: '#FFFFFF',
    onHeroSoft: 'rgba(255,255,255,0.74)',
    onHeroFaint: 'rgba(255,255,255,0.46)',
    onHeroChip: 'rgba(255,255,255,0.12)',
    onHeroChipBorder: 'rgba(255,255,255,0.24)',
    heroChipActive: REVISION_INK.amber,
    onHeroChipActive: '#FFFFFF',
    tabActive: REVISION_INK.indigo,
    logo: REVISION_INK.indigo,
    logoButton: REVISION_INK.indigo,
    logoRing: REVISION_INK.amber,
    neon: REVISION_INK.indigo,
    neonTint: REVISION_INK.light,
  },
  dark: {
    primary: '#3A4BC2',
    primaryLight: '#1E2766',
    primaryDark: '#2A3799',
    secondary: '#8A98E8',
    secondaryLight: '#1E2766',
    info: '#3A4BC2',
    infoLight: '#1E2766',
    infoText: '#B9C3FF',
    brand: '#AFB9F5',
    brandDeep: REVISION_INK.indigoDeeper,
    brandTint: '#1E2766',
    onHeroChip: 'rgba(231,145,58,0.12)',
    onHeroChipBorder: 'rgba(231,145,58,0.34)',
    heroChipActive: REVISION_INK.amber,
    onHeroChipActive: '#FFFFFF',
    tabActive: REVISION_INK.amber,
    logoRing: REVISION_INK.amber,
    neon: REVISION_INK.amber,
    neonTint: '#3F2A10',
  },
};

export const revisionGradients: Record<Scheme, Partial<GradientSet>> = {
  light: {
    primary: ['#2A3480', REVISION_INK.indigoDeep],
    hero: ['#2A3480', REVISION_INK.indigo, REVISION_INK.indigoDeep],
    auth: [REVISION_INK.indigo, REVISION_INK.indigoDeep, REVISION_INK.indigoDeeper],
  },
  dark: {
    primary: ['#3F51CC', '#2A3799'],
    hero: ['#1C2673', '#141B52', '#0C1138'],
    auth: ['#1C2673', '#121845', '#080C28'],
  },
};
