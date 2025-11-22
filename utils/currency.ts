// Currency formatting utility functions

export function formatCurrency(amount: number, currency: string = 'CAD'): string {
  const symbol = currency === 'USD' ? '$' : '$';
  return `${symbol}${Math.round(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
}

export function getCurrencySymbol(currency: string = 'CAD'): string {
  return currency === 'USD' ? '$' : '$';
}

export function formatCurrencyWithoutCode(amount: number, currency: string = 'CAD'): string {
  const symbol = getCurrencySymbol(currency);
  return `${Math.round(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
