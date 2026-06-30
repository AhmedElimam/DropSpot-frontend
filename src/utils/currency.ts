export function formatEGP(amount: number): string {
  return `${amount.toLocaleString('ar-EG')} ج.م`;
}

export function formatEGPShort(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    return `${k.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ألف ج.م`;
  }
  return formatEGP(amount);
}
