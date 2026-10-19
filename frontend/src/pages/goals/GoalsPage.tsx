import { Target } from 'lucide-react';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PageHeading } from '@/shared/ui/PageHeading';

export function GoalsPage() {
  return (
    <>
      <PageHeading title="Цели" description="Планируй крупные покупки и откладывай понемногу." />
      <EmptyState icon={Target} title="Место для будущих планов">Раздел в разработке. Здесь можно будет создать копилку, выбрать срок и следить за прогрессом накоплений.</EmptyState>
    </>
  );
}
