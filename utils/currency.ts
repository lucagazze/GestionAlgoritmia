export const formatMoney = (amount: number, currency: string = 'ARS'): string => {
  const formatted = new Intl.NumberFormat('es-AR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
  }).format(amount);
  
  return currency === 'ARS' ? `ARS ${formatted}` : `USD ${formatted}`;
};
