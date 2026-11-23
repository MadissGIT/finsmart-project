import { CreditCard, House, MoreHorizontal, PiggyBank, TicketPercent } from 'lucide-react';

export const navigation = [
  { to: '/', label: 'Обзор', icon: House },
  { to: '/transactions', label: 'Транзакции', icon: CreditCard },
  { to: '/goals', label: 'Копилки', icon: PiggyBank },
  { to: '/discounts', label: 'Скидки', icon: TicketPercent },
  { to: '/more', label: 'Ещё', icon: MoreHorizontal },
];
