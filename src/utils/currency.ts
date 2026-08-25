import { formatNumber } from './format';

// EGP display. The symbol lives here once (ج.م); numerals go through the shared
// formatNumber helper so Arabic-Indic formatting has a single implementation.
const EGP = 'ج.م';

export function formatEGP(amount: number): string {
  return `${formatNumber(amount)} ${EGP}`;
}

export function formatEGPShort(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    return `${formatNumber(k, { maximumFractionDigits: 1 })} ألف ${EGP}`;
  }
  return formatEGP(amount);
}
