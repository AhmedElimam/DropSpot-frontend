/**
 * The two palettes. Every key exists in both, so a screen that reads `colors.x` is never
 * handed `undefined` when the scheme flips. Founder 2026-10-03: «the top blue on page — put
 * some love on the theme; and a dark mode, not black: dark blue with neon»; then, on the
 * first cut: «the light mist isn't comfortable for the eye — the standard warmer colour».
 *
 * LIGHT — the standard Sanad warm paper (#F4F1EB) with white cards, exactly the canvas the
 * screens were designed on. What changed is the page header: no longer a dark slab, it is
 * the paper itself, a shade deeper at the very top, with ink text. Colour lives in cards,
 * chips and numbers — not in a band.
 *
 * DARK — "Midnight". Deep navy, never black; surfaces one step lighter navy; the brand's
 * apricot turns neon (#FF9A2E) and is the signature (tab bar, chips, the hero's glass) —
 * cyan was tried first and rejected (founder 2026-10-03), with mint / amber / coral for state
 * text. Selection tints are SOLID colours a clear step lighter than the surface they sit
 * on (a translucent tint over navy was too faint to read as "selected"); borders likewise.
 * Fills that carry white text (buttons, badges) stay saturated-but-deep so the white keeps
 * its contrast; the neon goes on text and borders, where it reads, not on fills.
 */
export type Scheme = 'light' | 'dark';

export interface Palette {
  primary: string; primaryLight: string; primaryDark: string;
  secondary: string; secondaryLight: string;
  accent: string; accentLight: string;
  success: string; successLight: string; successDark: string; successText: string;
  warning: string; warningLight: string; warningDark: string; warningText: string;
  danger: string; dangerLight: string; dangerDark: string; dangerText: string;
  info: string; infoLight: string; infoText: string;
  white: string;
  background: string; surface: string; border: string; borderLight: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textInverse: string;
  overlay: string; overlayLight: string; whatsapp: string;
  paper: string; surfaceSunken: string; borderStrong: string;
  ink: string; inkSoft: string; inkFaint: string;
  brand: string; brandDeep: string; brandTint: string;
  /** `onAccent` = text/icons ON a solid orange fill (white, founder 2026-10-03); `accentText`
   *  = orange-toned text on the LIGHT orange tint (`accentLight`). */
  accentWarm: string; accentWarmTint: string; onAccent: string; accentText: string;
  /** Text and icons ON the page hero (ink in light, white in dark). */
  onHero: string; onHeroSoft: string; onHeroFaint: string;
  /** Glass chips / stat tiles ON the hero, and the SELECTED chip with its text. */
  onHeroChip: string; onHeroChipBorder: string; heroChipActive: string; onHeroChipActive: string;
  /** Text on a `primary` fill. */
  onPrimary: string;
  /** Bottom tab bar. */
  tabActive: string; tabInactive: string; tabBar: string;
  /** The neon signature (dark) / brand (light): focus rings, live dots, glows. */
  neon: string; neonTint: string;
  /** Shadow colour for the elevation presets. */
  shadow: string;
}

export const light: Palette = {
  primary: '#34419B',
  // Selection tints a shade deeper than the old #ECEEF9: a selected chip must read as
  // selected on a white card, not only by its border (founder 2026-10-03).
  primaryLight: '#E3E7F7',
  primaryDark: '#1E2657',
  secondary: '#4A57B5',
  secondaryLight: '#E3E7F7',
  accent: '#E7913A',
  accentLight: '#F9E6CF',

  success: '#1F9366',
  successLight: '#E2F1EA',
  successDark: '#17734F',
  successText: '#14603F',
  warning: '#B27C10',
  warningLight: '#F6EBD1',
  warningDark: '#8A6109',
  warningText: '#6B4A05',
  danger: '#CB3A4C',
  dangerLight: '#F7E0E3',
  dangerDark: '#A82C3C',
  dangerText: '#7C1F2B',
  info: '#34419B',
  infoLight: '#E3E7F7',
  infoText: '#26306E',

  white: '#FFFFFF',
  // Warm paper canvas — chosen, not a default clinical grey
  background: '#F4F1EB',
  surface: '#FFFFFF',
  // A touch firmer than before so an input's edge shows on the sunken fill.
  border: '#DFD8C9',
  borderLight: '#EBE6DA',

  textPrimary: '#1A2140',
  textSecondary: '#55607A',
  textTertiary: '#939AB0',
  textInverse: '#FFFFFF',

  overlay: 'rgba(26, 33, 64, 0.5)',
  overlayLight: 'rgba(26, 33, 64, 0.3)',
  whatsapp: '#25D366',

  paper: '#F4F1EB',
  surfaceSunken: '#FAF8F3',
  borderStrong: '#CFC6B3',
  ink: '#1A2140',
  inkSoft: '#55607A',
  inkFaint: '#939AB0',
  brand: '#34419B',
  brandDeep: '#1E2657',
  brandTint: '#E3E7F7',
  accentWarm: '#E7913A',
  accentWarmTint: '#F9E6CF',
  // White on orange (founder 2026-10-03: «orange background but the text is black — make it
  // white»). Below 4.5:1 on purpose; see palettes.test.
  onAccent: '#FFFFFF',
  accentText: '#8A4B0F',

  onHero: '#1A2140',
  onHeroSoft: '#55607A',
  onHeroFaint: '#7F88A0',
  onHeroChip: 'rgba(26,33,64,0.07)',
  onHeroChipBorder: 'rgba(26,33,64,0.14)',
  heroChipActive: '#34419B',
  onHeroChipActive: '#FFFFFF',
  onPrimary: '#FFFFFF',
  tabActive: '#34419B',
  tabInactive: '#939AB0',
  tabBar: '#FFFFFF',
  neon: '#34419B',
  neonTint: '#E3E7F7',
  shadow: '#1A2140',
};

export const dark: Palette = {
  primary: '#4A66F0',
  primaryLight: '#233070',
  primaryDark: '#3650D6',
  secondary: '#7C8DFF',
  secondaryLight: '#2A3680',
  accent: '#FF9A2E',
  accentLight: '#3F2A10',

  success: '#15A076',
  successLight: '#0F3D34',
  successDark: '#0F7E5C',
  successText: '#5CF2C2',
  warning: '#B8841A',
  warningLight: '#3F2F10',
  warningDark: '#8F6410',
  warningText: '#FFD166',
  danger: '#D9324F',
  dangerLight: '#55203A',
  dangerDark: '#B0273F',
  dangerText: '#FF8DA1',
  info: '#4A66F0',
  infoLight: '#233070',
  infoText: '#9DB1FF',

  white: '#FFFFFF',
  background: '#080E26',
  surface: '#11183A',
  border: '#29357A',
  borderLight: '#1F2860',

  textPrimary: '#EEF2FF',
  textSecondary: '#AAB4E6',
  textTertiary: '#7682BF',
  textInverse: '#FFFFFF',

  overlay: 'rgba(3, 6, 20, 0.65)',
  overlayLight: 'rgba(3, 6, 20, 0.4)',
  whatsapp: '#25D366',

  paper: '#080E26',
  surfaceSunken: '#0C1330',
  borderStrong: '#4A5AB8',
  ink: '#EEF2FF',
  inkSoft: '#AAB4E6',
  inkFaint: '#7682BF',
  brand: '#7489F2', // a little darker than #8FA2FF (founder 2026-10-04); navy surfaces deepened the same day
  brandDeep: '#0B1136',
  brandTint: '#233070',
  accentWarm: '#FFB454',
  accentWarmTint: '#3F2F10',
  onAccent: '#FFFFFF',
  accentText: '#FFC27A',

  onHero: '#FFFFFF',
  onHeroSoft: 'rgba(255,255,255,0.72)',
  onHeroFaint: 'rgba(255,255,255,0.45)',
  onHeroChip: 'rgba(255,154,46,0.10)',
  onHeroChipBorder: 'rgba(255,154,46,0.30)',
  heroChipActive: '#FFFFFF',
  onHeroChipActive: '#080E26',
  onPrimary: '#FFFFFF',
  tabActive: '#FF9A2E',
  tabInactive: '#6F7BB8',
  tabBar: '#0C1330',
  neon: '#FF9A2E',
  neonTint: '#3F2A10',
  shadow: '#000000',
};

export const palettes: Record<Scheme, Palette> = { light, dark };

export interface GradientSet {
  primary: readonly [string, string];
  accent: readonly [string, string];
  success: readonly [string, string];
  warm: readonly [string, string];
  surface: readonly [string, string];
  /** The page header. Light: the paper, a shade deeper at the top. Dark: deep navy. */
  hero: readonly [string, string, string];
  /** Login / register / welcome: full-screen deep ink in both schemes (founder 2026-10-02
   *  asked for the blue there — it is the one place the dark band stays in light mode). */
  auth: readonly [string, string, string];
}

export const gradientSets: Record<Scheme, GradientSet> = {
  light: {
    primary: ['#3A46A8', '#2E3A93'],
    accent: ['#E7913A', '#D97B22'],
    success: ['#1F9366', '#17734F'],
    warm: ['#E7913A', '#D97B22'],
    surface: ['#FFFFFF', '#FAF8F3'],
    hero: ['#E8E1D2', '#EFEAE0', '#F4F1EB'],
    auth: ['#232C6B', '#1A2147', '#171C3B'],
  },
  dark: {
    primary: ['#5370F0', '#3A4FD6'],
    accent: ['#FF9A2E', '#E07E14'],
    success: ['#1DBA8A', '#15A076'],
    warm: ['#FFB454', '#F09A2C'],
    surface: ['#11183A', '#0C1330'],
    hero: ['#121D5C', '#0B123C', '#080E26'],
    auth: ['#121D5C', '#0A1137', '#060A1F'],
  },
};
