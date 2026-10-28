const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2,
});

export function formatMoney(value: number): string {
  return rubles.format(value);
}
