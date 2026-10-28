import { TicketPercent } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageHeading } from '@/shared/ui/PageHeading';

export function DiscountsPage() {
  return <><PageHeading title="Скидки" description="Предложения, которые помогут тратить меньше." /><EmptyState icon={TicketPercent} title="Предложения появятся здесь">Витрина скидок пока в разработке. Персональные предложения появятся после подключения соответствующего API.</EmptyState></>;
}
