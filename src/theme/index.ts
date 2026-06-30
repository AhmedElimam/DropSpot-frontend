import { fonts } from './typography';
export { fonts } from './typography';

export const colors = {
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  primaryDark: '#4F46E5',
  secondary: '#8B5CF6',
  secondaryLight: '#F5F3FF',
  accent: '#06B6D4',
  accentLight: '#ECFEFF',
  success: '#10B981',
  successLight: '#D1FAE5',
  successDark: '#059669',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningDark: '#D97706',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  dangerDark: '#DC2626',
  info: '#6366F1',
  infoLight: '#EEF2FF',
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.5)',
  overlayLight: 'rgba(15, 23, 42, 0.3)',
  whatsapp: '#25D366',
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

export const shadows = {
  sm: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const gradients = {
  primary: ['#6366F1', '#8B5CF6'] as const,
  accent: ['#06B6D4', '#6366F1'] as const,
  success: ['#10B981', '#059669'] as const,
  warm: ['#F59E0B', '#EF4444'] as const,
  surface: ['#FFFFFF', '#F8FAFC'] as const,
} as const;

export const nav = {
  bottomHeight: 88,
} as const;

export const textPresets = {
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 36, color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: colors.textPrimary, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textPrimary },
  bodySmall: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 42, color: colors.textPrimary, letterSpacing: -1 },
} as const;
