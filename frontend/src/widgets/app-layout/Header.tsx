import { UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMoney } from '@/shared/lib/format';
import type { UserProfile } from '@/entities/user/model/types';

interface Props {
  balance?: number;
  profile?: UserProfile;
}

export function Header({ balance, profile }: Props) {
  return (
    <header className="flex min-h-20 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 sm:px-8 lg:px-10">
      <div>
        <p className="text-xs text-stone-500">Общий баланс</p>
        <p className="mt-1 text-lg font-semibold tabular-nums" aria-label={balance === undefined ? 'Баланс пока недоступен' : undefined}>
          {balance === undefined ? '— ₽' : formatMoney(balance)}
        </p>
      </div>
      <Link to="/auth" className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm font-medium hover:bg-stone-50">
        <span className="rounded-full bg-stone-100 p-2.5 text-stone-500"><UserRound size={18} aria-hidden="true" /></span>
        {profile?.full_name ?? 'Войти'}
      </Link>
    </header>
  );
}
