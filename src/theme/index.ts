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
  // Brand — ink indigo (authority, records, trust)
  primary: '#34419B',
  primaryLight: '#ECEEF9',
  primaryDark: '#1E2657',
  // Secondary kept as an indigo sibling (no more purple)
  secondary: '#4A57B5',
  secondaryLight: '#ECEEF9',
  // The single warm accent — apricot. Use rarely, for the most human moment.
  accent: '#E7913A',
  accentLight: '#FBEDDB',

  // Semantic — deliberately muted so state reads without shouting
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
  infoLight: '#ECEEF9',
  infoText: '#26306E',

  white: '#FFFFFF',
  // Warm paper canvas — chosen, not a default clinical grey
  background: '#F4F1EB',
  surface: '#FFFFFF',
  border: '#E7E1D5',
  borderLight: '#EFEBE2',

  // Ink text ramp
  textPrimary: '#1A2140',
  textSecondary: '#55607A',
  textTertiary: '#939AB0',
  textInverse: '#FFFFFF',

  overlay: 'rgba(26, 33, 64, 0.5)',
  overlayLight: 'rgba(26, 33, 64, 0.3)',
  whatsapp: '#25D366',

  // --- New Sanad semantic tokens (additive) ---
  paper: '#F4F1EB',
  surfaceSunken: '#FAF8F3',
  borderStrong: '#D8D1C2',
  ink: '#1A2140',
  inkSoft: '#55607A',
  inkFaint: '#939AB0',
  brand: '#34419B',
  brandDeep: '#1E2657',
  brandTint: '#ECEEF9',
  accentWarm: '#E7913A',
  accentWarmTint: '#FBEDDB',
  onAccent: '#231303',
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
  full: 9999,
} as const;

/**
 * Elevation — neutral ink shadows, softer and calmer than the old indigo glow.
 * Keys are unchanged (sm/md/lg/glow) so existing consumers keep working.
 */
export const shadows = {
  sm: {
    shadowColor: '#1A2140',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
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
