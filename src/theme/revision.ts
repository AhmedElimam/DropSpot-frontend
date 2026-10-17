import type { GradientSet, Palette, Scheme } from './palettes';

/**
 * «وضع المراجعة» — the revision season's overlay (founder 2026-10-16: «change our whole app UI
 * and theme on revision mode … be creative»). NOT a third scheme: a layer laid over Mist or
 * Midnight while the signed-in teacher's revise mode is on. Its family is the web dashboard's
 * revise theme — DEEP INDIGO #232C6B / #1A2147 / #141833 with an AMBER accent #E7913A and the
 * light #E4E7F6 — so both platforms read as one season.
 *
 * First cut (10-16) swapped only the brand / hero / tab tokens, and the founder said (10-17)
 * «on dark or light there's not much of a change». Midnight is already navy + orange, and the
 * day canvas stayed cream. So the season now owns the PAGE too, with one idea per scheme:
 *
 *   light «ورقة الامتحان»  the exam paper: a cool blue-grey canvas instead of the cream, white
 *                           cards with cool borders, a deep indigo hero band and an indigo tab
 *                           bar with an amber active tab — the page is framed in indigo.
 *   dark  «ليلة المراجعة»  the desk at night: the saturated Midnight navy gives way to a quiet
 *                           ink (less blue, a touch warmer), indigo heroes, and AMBER is the
 *                           signature — tabs, chips, numbers, focus — like a lamp on the desk.
 *
 * Both heroes carry the season's paper (SeasonPaper: faint ruled lines, the amber margin line
 * and a lamp glow), which is what makes a screenshot read «revision» at a glance. Still never
 * violet, never a wall: cards stay white / ink and every pair keeps its contrast (tests).
 */
export const REVISION_INK = {
  indigo: '#232C6B',
  indigoDeep: '#1A2147',
  indigoDeeper: '#141833',
  amber: '#E7913A',
  amberDeep: '#C9771F',
  /** The amber that reads on indigo / ink (tabs, the countdown number). */
  amberGlow: '#F2A65A',
  light: '#E4E7F6',
  /** Chip text on the light indigo tint. */
  onLight: '#1A2147',
} as const;

export const revisionOverlay: Record<Scheme, Partial<Palette>> = {
  light: {
    // The exam paper: cool, a step deeper than the cards so they float on it.
    background: '#E8EBF5',
    paper: '#E8EBF5',
    surface: '#FFFFFF',
    surfaceSunken: '#F3F5FB',
    border: '#D3D8EB',
    borderLight: '#E1E5F2',
    borderStrong: '#B6BEDC',
    textPrimary: '#141833',
    ink: '#141833',
    textSecondary: '#4A5478',
    inkSoft: '#4A5478',
    textTertiary: '#868EAE',
    inkFaint: '#868EAE',
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
    onHeroChip: 'rgba(255,255,255,0.10)',
    onHeroChipBorder: 'rgba(255,255,255,0.20)',
    heroChipActive: REVISION_INK.amber,
    onHeroChipActive: '#FFFFFF',
    // The indigo tab bar, amber where you are.
    tabBar: REVISION_INK.indigoDeep,
    tabActive: REVISION_INK.amberGlow,
    tabInactive: '#A9B0DA',
    logoButton: REVISION_INK.indigo,
    logoRing: REVISION_INK.amber,
    neon: REVISION_INK.indigo,
    neonTint: REVISION_INK.light,
    shadow: '#141833',
  },
  dark: {
    // Ink, not navy: the season reads apart from Midnight before anything else is seen.
    background: '#0D0F1E',
    paper: '#0D0F1E',
    surface: '#181B31',
    surfaceSunken: '#121429',
    border: '#2C3058',
    borderLight: '#222548',
    borderStrong: '#474D8C',
    textPrimary: '#F2F3FA',
    ink: '#F2F3FA',
    textSecondary: '#B4B9DB',
    inkSoft: '#B4B9DB',
    textTertiary: '#7F86B2',
    inkFaint: '#7F86B2',
    primary: '#3F4FC8',
    primaryLight: '#252A5E',
    primaryDark: '#2F3CA6',
    secondary: '#8E9AE6',
    secondaryLight: '#252A5E',
    info: '#3F4FC8',
    infoLight: '#252A5E',
    infoText: '#BAC3FF',
    brand: '#AEB8F2',
    brandDeep: REVISION_INK.indigoDeeper,
    brandTint: '#252A5E',
    // The lamp: one amber, everywhere the night scheme had its orange neon.
    accent: REVISION_INK.amberGlow,
    accentLight: '#3A2A16',
    accentWarm: '#F7B56E',
    accentWarmTint: '#3A2A16',
    accentText: '#FFC98A',
    onHeroChip: 'rgba(242,166,90,0.11)',
    onHeroChipBorder: 'rgba(242,166,90,0.30)',
    heroChipActive: REVISION_INK.amber,
    onHeroChipActive: '#FFFFFF',
    tabBar: '#121429',
    tabActive: REVISION_INK.amberGlow,
    tabInactive: '#737AA8',
    logoButton: REVISION_INK.indigo,
    logoRing: REVISION_INK.amber,
    neon: REVISION_INK.amberGlow,
    neonTint: '#3A2A16',
  },
};

export const revisionGradients: Record<Scheme, Partial<GradientSet>> = {
  light: {
    primary: ['#2A3480', REVISION_INK.indigoDeep],
    hero: ['#2E3990', REVISION_INK.indigo, REVISION_INK.indigoDeep],
    auth: [REVISION_INK.indigo, REVISION_INK.indigoDeep, REVISION_INK.indigoDeeper],
    surface: ['#FFFFFF', '#F3F5FB'],
  },
  dark: {
    primary: ['#4757D2', '#2F3CA6'],
    accent: [REVISION_INK.amberGlow, REVISION_INK.amberDeep],
    warm: ['#F7B56E', REVISION_INK.amber],
    // Indigo at the top, falling into the night ink of the page.
    hero: ['#28317C', '#191E4E', '#0D0F1E'],
    auth: ['#28317C', '#161B45', '#0B0C1A'],
    surface: ['#181B31', '#121429'],
  },
};
