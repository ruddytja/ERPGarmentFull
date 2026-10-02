import { CurrencyType } from '../types/costing';

export const IDR_TO_USD_RATE = 15600;

export function formatCurrency(amount: number, currency: CurrencyType = 'IDR'): string {
  if (currency === 'USD') {
    const usd = amount / IDR_TO_USD_RATE;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: usd >= 1000 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(usd);
  }

  // Indonesian Rupiah format: Rp 895.200.000 or -Rp 13.050.000
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(absAmount);

  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('id-ID').format(val);
}
