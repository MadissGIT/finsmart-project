import { ArrowLeftRight, ChartPie, LayoutDashboard, Target, UserRound } from 'lucide-react';

export const navigation = [
  { to: '/', label: 'Обзор', icon: LayoutDashboard },
  { to: '/transactions', label: 'Операции', icon: ArrowLeftRight },
  { to: '/analytics', label: 'Аналитика', icon: ChartPie },
  { to: '/goals', label: 'Цели', icon: Target },
  { to: '/auth', label: 'Профиль', icon: UserRound },
];
