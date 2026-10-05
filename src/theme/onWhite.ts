/**
 * Text and icon colours for surfaces that are ALWAYS white, whatever the scheme — a white
 * button on a coloured card, a QR plate, the welcome CTA. Theme tokens such as `brand` or
 * `successText` flip to light tints in dark mode, which put bright text on a bright button
 * (founder 2026-10-03: «bright text on bright background» on the live-session card). These
 * are fixed on purpose: the surface does not change, so the ink must not either.
 */
export const onWhite = {
  ink: '#1A2140',
  muted: '#55607A',
  brand: '#34419B',
  success: '#17734F',
  warning: '#92400E',
  danger: '#B91C1C',
} as const;
