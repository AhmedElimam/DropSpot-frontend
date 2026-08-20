import { fonts } from './typography';
export { fonts } from './typography';

/**
 * Sanad design language — "سند" (support · a documented record).
 *
 * Warm-paper canvas, deep ink-indigo authority, one apricot accent used
 * sparingly. High contrast and a generous type scale for older parents on
 * mid-range Android outdoors. Every legacy token name is preserved so existing
 * screens keep compiling while they are re-skinned onto the new palette.
 */
export const colors = {
  // Palette is the EXACT redesign-spec :root (student-app-screens.html). Legacy
  // token names are kept but remapped to these values so the whole app — new and
  // old screens alike — renders the one true palette.
  // Brand — ink indigo
  primary: '#34419B',
  primaryLight: '#EEF0FA',
  primaryDark: '#1E2657',
  secondary: '#4C5BC4',
  secondaryLight: '#EEF0FA',
  // The single warm accent — apricot, reserved for attention/warning only.
  accent: '#E7913A',
  accentLight: '#FDF1E3',

  // Semantic
  success: '#17A673',
  successLight: '#E6F6F0',
  successDark: '#12855C',
  successText: '#0F7A54',
  warning: '#E7913A',
  warningLight: '#FDF1E3',
  warningDark: '#C9761F',
  warningText: '#8A5A15',
  danger: '#D6564F',
  dangerLight: '#FCEBEA',
  dangerDark: '#B23E38',
  dangerText: '#A33A34',
  info: '#34419B',
  infoLight: '#EEF0FA',
  infoText: '#2A3585',

  white: '#FFFFFF',
  // Cool off-white canvas (spec --bg), never pure white
  background: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#EDEBE4',
  borderLight: '#F2F0EA',

  // Ink text ramp (spec ink/muted/faint)
  textPrimary: '#16182B',
  textSecondary: '#6E7385',
  textTertiary: '#A3A7B7',
  textInverse: '#FFFFFF',

  overlay: 'rgba(22, 24, 43, 0.5)',
  overlayLight: 'rgba(22, 24, 43, 0.3)',
  whatsapp: '#25D366',

  // --- Sanad / spec semantic tokens ---
  paper: '#F7F6F3',
  surfaceSunken: '#FAFAF8',
  borderStrong: '#D9D7D0',
  ink: '#16182B',
  inkSoft: '#6E7385',
  inkFaint: '#A3A7B7',
  brand: '#34419B',
  brand2: '#4C5BC4',
  brandDeep: '#1E2657',
  brandTint: '#EEF0FA',
  brandWash: '#EEF0FA',
  good: '#17A673',
  goodWash: '#E6F6F0',
  warn: '#E7913A',
  warnWash: '#FDF1E3',
  dangerWash: '#FCEBEA',
  accentWarm: '#E7913A',
  accentWarmTint: '#FDF1E3',
  onAccent: '#231303',
  // Spec aliases (exact spec names)
  bg: '#F7F6F3',
  line: '#EDEBE4',
  muted: '#6E7385',
  faint: '#A3A7B7',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xl4: 40,
  xl5: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  // Large surfaces from the redesign — hero cards and bottom sheets
  hero: 26,
  sheet: 28,
  // Redesign-spec aliases (card = list/hero body 20, chip = pill 20)
  card: 20,
  chip: 20,
  full: 9999,
} as const;

/**
 * Layout rhythm — the spacing the redesign standardises across every screen so
 * padding/gaps stop being ad-hoc per screen. Additive; screens adopt these as
 * they are re-skinned. `tabBottom` is the scroll bottom-padding that clears the
 * raised-centre tab bar.
 */
export const layout = {
  screenPadding: 18,
  cardGap: 11,
  sectionGap: 22,
  tabBottom: 108,
} as const;

/**
 * Elevation — neutral ink shadows, softer and calmer than the old indigo glow.
 * Keys are unchanged (sm/md/lg/glow) so existing consumers keep working.
 */
export const shadows = {
  sm: {
    // Spec --sh: a soft, wide float (not a tight drop) so cards lift off the canvas
    shadowColor: '#16182B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  md: {
    shadowColor: '#1A2140',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#1A2140',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  // Used by the bottom tab bar — a soft lift, no coloured glow
  glow: {
    shadowColor: '#1A2140',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  // Brand-tinted lift for the HeroCard — the one place a coloured shadow is used
  hero: {
    shadowColor: '#34419B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/**
 * Gradients — restrained. `primary` is a grounded indigo (used by filled
 * buttons); `hero` is the deep-ink header band. No indigo→purple.
 */
export const gradients = {
  primary: ['#3A46A8', '#2E3A93'] as const,
  accent: ['#E7913A', '#D97B22'] as const,
  success: ['#1F9366', '#17734F'] as const,
  warm: ['#E7913A', '#D97B22'] as const,
  surface: ['#FFFFFF', '#FAF8F3'] as const,
  // Deep-ink hero band for screen headers
  hero: ['#232C6B', '#1A2147', '#171C3B'] as const,
  // Brand indigo for the HeroCard (spec: linear-gradient(145deg, brand, brand2))
  brandCard: ['#34419B', '#4C5BC4'] as const,
} as const;

export const nav = {
  bottomHeight: 88,
} as const;

/**
 * Type scale — Cairo. Base body raised to 17 for elderly legibility; headings
 * step 18 → 34. Every preset resolves its colour through the ink ramp above.
 */
export const textPresets = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 44, color: colors.textPrimary, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38, color: colors.textPrimary, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: colors.textPrimary, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 26, color: colors.textPrimary },
  // Parent-facing body text: 17px minimum (elderly-usability rule)
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: colors.textPrimary },
  bodySmall: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textTertiary },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
} as const;

// Minimum touch target (parent app rule: 44pt iOS / 48dp Android)
export const touchTarget = { minHeight: 48, minWidth: 48 } as const;

// Primary control height — thumb-sized for elderly parents
export const control = { minHeight: 52 } as const;
