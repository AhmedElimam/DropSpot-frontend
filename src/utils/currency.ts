import { formatNumber } from './format';

// EGP display. The symbol lives here once (ج.م); numerals go through the shared
// formatNumber helper so Arabic-Indic formatting has a single implementation.
const EGP = 'ج.م';

export function formatEGP(amount: number): string {
  return `${formatNumber(amount)} ${EGP}`;
}

/**
 * A bare amount for display (no currency suffix): whole numbers render with NO
 * decimals (10, not 10.00), fractional amounts keep only the digits they need
 * (10.5, 10.25). Use in the pay/scan screens that append « ج.م » themselves —
 * replaces `.toFixed(2)`, which forced a trailing “.00”.
 */
export function formatMoney(amount: number): string {
  const n = Math.round((Number(amount) || 0) * 100) / 100;
  return String(n);
}

export function formatEGPShort(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    return `${formatNumber(k, { maximumFractionDigits: 1 })} ألف ${EGP}`;
  }
  return formatEGP(amount);
}
