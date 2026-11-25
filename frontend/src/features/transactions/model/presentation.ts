export const transactionAsset = (name: string) => '/figma/transactions/' + name;
const categoryColors: Record<number, string> = { 1: '#2733db', 2: '#ffb72b', 3: '#458eff', 4: '#5553ed', 5: '#ff963c', 6: '#13bd91', 7: '#ff668e', 8: '#cb80d9', 9: '#7c79df', 10: '#13bd91' };
export const categoryColor = (id: number) => categoryColors[id] ?? '#7484a2';

export function formatTransactionTitle(value: string): string {
  return value.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('ru-RU'));
}
