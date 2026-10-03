/**
 * The two palettes. Every key exists in both, so a screen that reads `colors.x` is never
 * handed `undefined` when the scheme flips. Founder 2026-10-03: «the app background
 * whiteness and the top blue on page — put some love on the theme; and a dark mode, not
 * black: dark blue with neon».
 *
 * LIGHT — "Mist". The canvas is a cool, faintly indigo mist instead of white or paper, and
 * the page header is no longer a dark slab: it is the mist itself, a shade deeper at the
 * very top, with ink text. Colour lives in cards, chips and numbers — not in a band.
 *
 * DARK — "Midnight". Deep navy, never black; surfaces one step lighter navy; neon cyan is
 * the signature (tab bar, chips, the hero's glass), with mint / amber / coral for state
 * text. Fills that carry white text (buttons, badges) stay saturated-but-deep so the white
 * keeps its contrast; the neon goes on text and borders, where it reads, not on fills.
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
  accentWarm: string; accentWarmTint: string; onAccent: string;
  /** Text and icons ON the page hero (ink in light, white in dark). */
  onHero: string; onHeroSoft: string; onHeroFaint: string;
  /** Glass chips / stat tiles ON the hero. */
  onHeroChip: string; onHeroChipBorder: string;
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
  primaryLight: '#E4E8FA',
  primaryDark: '#1E2657',
  secondary: '#4A57B5',
  secondaryLight: '#E4E8FA',
  accent: '#E7913A',
  accentLight: '#FBEDDB',

  success: '#1F9366',
  successLight: '#DDF2E8',
  successDark: '#17734F',
  successText: '#14603F',
  warning: '#B27C10',
  warningLight: '#F8ECCF',
  warningDark: '#8A6109',
  warningText: '#6B4A05',
  danger: '#CB3A4C',
  dangerLight: '#FADFE3',
  dangerDark: '#A82C3C',
  dangerText: '#7C1F2B',
  info: '#34419B',
  infoLight: '#E4E8FA',
  infoText: '#26306E',

  white: '#FFFFFF',
  background: '#E9EDF6',
  surface: '#FFFFFF',
  border: '#D6DCEA',
  borderLight: '#E3E8F2',

  textPrimary: '#161C3A',
  textSecondary: '#4F5A78',
  textTertiary: '#8A93AE',
  textInverse: '#FFFFFF',

  overlay: 'rgba(22, 28, 58, 0.5)',
  overlayLight: 'rgba(22, 28, 58, 0.3)',
  whatsapp: '#25D366',

  paper: '#E9EDF6',
  surfaceSunken: '#F3F5FB',
  borderStrong: '#C3CBE0',
  ink: '#161C3A',
  inkSoft: '#4F5A78',
  inkFaint: '#8A93AE',
  brand: '#34419B',
  brandDeep: '#1E2657',
  brandTint: '#E4E8FA',
  accentWarm: '#E7913A',
  accentWarmTint: '#FBEDDB',
  onAccent: '#231303',

  onHero: '#161C3A',
  onHeroSoft: '#4F5A78',
  onHeroFaint: '#7F88A6',
  onHeroChip: 'rgba(52,65,155,0.08)',
  onHeroChipBorder: 'rgba(52,65,155,0.16)',
  onPrimary: '#FFFFFF',
  tabActive: '#34419B',
  tabInactive: '#8A93AE',
  tabBar: '#FFFFFF',
  neon: '#34419B',
  neonTint: 'rgba(52,65,155,0.12)',
  shadow: '#1A2140',
};

export const dark: Palette = {
  primary: '#4A66F0',
  primaryLight: 'rgba(96,120,255,0.18)',
  primaryDark: '#3650D6',
  secondary: '#7C8DFF',
  secondaryLight: 'rgba(124,141,255,0.16)',
  accent: '#2EE6FF',
  accentLight: 'rgba(46,230,255,0.14)',

  success: '#15A076',
  successLight: 'rgba(53,245,197,0.14)',
  successDark: '#0F7E5C',
  successText: '#5CF2C2',
  warning: '#B8841A',
  warningLight: 'rgba(255,200,61,0.14)',
  warningDark: '#8F6410',
  warningText: '#FFD166',
  danger: '#D9324F',
  dangerLight: 'rgba(255,84,112,0.16)',
  dangerDark: '#B0273F',
  dangerText: '#FF8DA1',
  info: '#4A66F0',
  infoLight: 'rgba(96,120,255,0.18)',
  infoText: '#9DB1FF',

  white: '#FFFFFF',
  background: '#0B1230',
  surface: '#141C45',
  border: '#283373',
  borderLight: '#1F2A62',

  textPrimary: '#EEF2FF',
  textSecondary: '#AAB4E6',
  textTertiary: '#7682BF',
  textInverse: '#FFFFFF',

  overlay: 'rgba(3, 6, 20, 0.65)',
  overlayLight: 'rgba(3, 6, 20, 0.4)',
  whatsapp: '#25D366',

  paper: '#0B1230',
  surfaceSunken: '#0F1739',
  borderStrong: '#3A48A0',
  ink: '#EEF2FF',
  inkSoft: '#AAB4E6',
  inkFaint: '#7682BF',
  brand: '#8FA2FF',
  brandDeep: '#0E1540',
  brandTint: 'rgba(124,141,255,0.16)',
  accentWarm: '#FFB454',
  accentWarmTint: 'rgba(255,180,84,0.16)',
  onAccent: '#04111F',

  onHero: '#FFFFFF',
  onHeroSoft: 'rgba(255,255,255,0.72)',
  onHeroFaint: 'rgba(255,255,255,0.45)',
  onHeroChip: 'rgba(46,230,255,0.10)',
  onHeroChipBorder: 'rgba(46,230,255,0.24)',
  onPrimary: '#FFFFFF',
  tabActive: '#2EE6FF',
  tabInactive: '#6F7BB8',
  tabBar: '#0F1739',
  neon: '#2EE6FF',
  neonTint: 'rgba(46,230,255,0.14)',
  shadow: '#000000',
};

export const palettes: Record<Scheme, Palette> = { light, dark };

export interface GradientSet {
  primary: readonly [string, string];
  accent: readonly [string, string];
  success: readonly [string, string];
  warm: readonly [string, string];
  surface: readonly [string, string];
  /** The page header. Light: the mist, a shade deeper at the top. Dark: deep navy. */
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
    surface: ['#FFFFFF', '#F3F5FB'],
    hero: ['#D9E0F4', '#E3E8F5', '#E9EDF6'],
    auth: ['#232C6B', '#1A2147', '#171C3B'],
  },
  dark: {
    primary: ['#5F7CFF', '#4257E6'],
    accent: ['#2EE6FF', '#17B8D6'],
    success: ['#1DBA8A', '#15A076'],
    warm: ['#FFB454', '#F09A2C'],
    surface: ['#141C45', '#0F1739'],
    hero: ['#15226A', '#0E1646', '#0B1230'],
    auth: ['#15226A', '#0C1440', '#070C24'],
  },
};
