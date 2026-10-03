import { Platform } from 'react-native';
import { fonts } from './typography';
import { gradientSets, palettes, type GradientSet, type Palette, type Scheme } from './palettes';
export { fonts } from './typography';
export type { Palette, Scheme } from './palettes';

/**
 * Sanad design language — "سند" (support · a documented record), now in two schemes
 * (src/theme/palettes.ts): "Mist" by day and "Midnight" (navy + neon) by night.
 *
 * `colors` and `gradients` are LIVE objects: `applyScheme()` rewrites their values in place,
 * so the ~4,000 inline `colors.x` reads across the app pick up the scheme on their next
 * render without a hook in every file. What forces that render is the root layout, which
 * re-keys the navigation tree on a scheme change (react-navigation's StaticContainer would
 * otherwise keep every mounted screen exactly as it was). `shadows` and `textPresets` are
 * getters for the same reason — a value captured at import time would stay on one scheme.
 *
 * Every legacy token name is preserved so existing screens keep compiling.
 */
export const colors: Palette = { ...palettes.light };
export const gradients: GradientSet = { ...gradientSets.light };

let scheme: Scheme = 'light';

/** Switch every live token to `next`. Idempotent; returns whether anything changed. */
export function applyScheme(next: Scheme): boolean {
  const changed = next !== scheme;
  scheme = next;
  Object.assign(colors, palettes[next]);
  Object.assign(gradients, gradientSets[next]);
  return changed;
}

export function currentScheme(): Scheme {
  return scheme;
}

export const isDark = () => scheme === 'dark';

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
 * Elevation — neutral ink shadows by day; by night a deeper drop (the surface is already
 * the lighter navy, so the shadow only has to separate card from canvas). Keys are
 * unchanged (sm/md/lg/glow) so existing consumers keep working.
 *
 * ANDROID GETS NO SHADOW, ON PURPOSE (2026-09-22).
 * `shadowColor/Offset/Opacity/Radius` are iOS-only — Android ignores them and reads
 * `elevation` alone. Every elevated view on Android is promoted to its OWN render layer
 * whose shadow is rasterised each time it is drawn, and the cost is per view, not per
 * pixel of shadow: `elevation: 1` on a list row is nearly as expensive as `elevation: 8`.
 * These presets are spread into 81 places — cards, rows, headers, badges — so a roster
 * or a session list was asking an entry-level GPU for dozens of extra layers on every
 * frame it scrolled. That is GPU time and heat, and it is the largest single graphics
 * cost in the app on the devices that complained (Redmi Note 11S and older, slow
 * scrolling + heat).
 *
 * The trade is visual: on Android, cards are FLAT. They stay legible because `surface`
 * is lighter than `background` and most cards already carry a 1px border. iOS is
 * untouched. To put the shadows back, set ANDROID_ELEVATION to true.
 */
const ANDROID_ELEVATION = false;
const el = (n: number) => (Platform.OS === 'android' && !ANDROID_ELEVATION ? {} : { elevation: n });

type Shadow = { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation?: number };
const shadow = (height: number, opacity: number, blur: number, elevation: number): Shadow => ({
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height },
  shadowOpacity: isDark() ? Math.min(0.6, opacity * 3) : opacity,
  shadowRadius: blur,
  ...el(elevation),
});

export const shadows = {
  get sm(): Shadow { return shadow(1, 0.06, 3, 1); },
  get md(): Shadow { return shadow(4, 0.08, 12, 3); },
  get lg(): Shadow { return shadow(10, 0.12, 24, 8); },
  // Used by the bottom tab bar — a soft lift by day; by night the neon breathes under it.
  get glow(): Shadow {
    return isDark()
      ? { shadowColor: colors.neon, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.22, shadowRadius: 16, ...el(8) }
      : shadow(-2, 0.06, 12, 8);
  },
};

export const nav = {
  bottomHeight: 88,
} as const;

/**
 * Type scale — Cairo. Base body raised to 17 for elderly legibility; headings
 * step 18 → 34. Every preset resolves its colour through the ink ramp above, live.
 */
type Preset = { fontFamily: string; fontSize: number; lineHeight: number; color: string; letterSpacing?: number };
export const textPresets = {
  get display(): Preset { return { fontFamily: fonts.bold, fontSize: 34, lineHeight: 44, color: colors.textPrimary, letterSpacing: -0.6 }; },
  get h1(): Preset { return { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38, color: colors.textPrimary, letterSpacing: -0.4 }; },
  get h2(): Preset { return { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: colors.textPrimary, letterSpacing: -0.2 }; },
  get h3(): Preset { return { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.textPrimary }; },
  get subtitle(): Preset { return { fontFamily: fonts.medium, fontSize: 18, lineHeight: 26, color: colors.textPrimary }; },
  // Parent-facing body text: 17px minimum (elderly-usability rule)
  get body(): Preset { return { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: colors.textPrimary }; },
  get bodySmall(): Preset { return { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary }; },
  get caption(): Preset { return { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textTertiary }; },
  get label(): Preset { return { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: colors.textSecondary }; },
};

// Minimum touch target (parent app rule: 44pt iOS / 48dp Android)
export const touchTarget = { minHeight: 48, minWidth: 48 } as const;

// Primary control height — thumb-sized for elderly parents
export const control = { minHeight: 52 } as const;
