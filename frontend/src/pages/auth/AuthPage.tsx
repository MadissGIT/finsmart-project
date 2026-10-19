import { UserRound } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageHeading } from '@/shared/ui/PageHeading';

export function AuthPage() {
  return (
    <>
      <PageHeading title="Профиль" description="Личный кабинет и настройки аккаунта." />
      <EmptyState icon={UserRound} title="Вход скоро появится">Раздел в разработке. Здесь будут формы входа и регистрации. Сейчас приложение работает без авторизации.</EmptyState>
    </>
  );
}
