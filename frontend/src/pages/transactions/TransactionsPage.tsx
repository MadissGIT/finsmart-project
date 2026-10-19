import { ArrowLeftRight } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageHeading } from '@/shared/ui/PageHeading';

export function TransactionsPage() {
  return (
    <>
      <PageHeading title="Операции" description="Доходы и расходы в одном месте." />
      <EmptyState icon={ArrowLeftRight} title="Здесь будут твои операции">Раздел в разработке. Здесь появятся загрузка банковской выписки, ручной ввод и список транзакций.</EmptyState>
    </>
  );
}
