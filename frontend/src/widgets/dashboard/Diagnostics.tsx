import { Lightbulb } from 'lucide-react';
import type { DashboardResponse } from '@/entities/analytics/model/types';
import { formatMoney } from '@/shared/lib/format';

export function Diagnostics({ diagnostics }: { diagnostics: DashboardResponse['diagnostics'] }) {
  return (
    <section className="panel" aria-labelledby="diagnostics-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="diagnostics-title" className="font-semibold">Финансовое здоровье</h2>
          <p className="mt-1 text-sm text-stone-500">{diagnostics.persona}</p>
        </div>
        <p className="text-sm text-stone-500"><span className="text-3xl font-semibold text-brand-700">{diagnostics.health_score}</span> / 100</p>
      </div>
      <progress aria-label="Рейтинг финансового здоровья" max={100} value={diagnostics.health_score} className="progress-meter mt-5">{diagnostics.health_score}</progress>
      {diagnostics.alerts.map((alert, index) => (
        <div key={`${alert.type}-${alert.category}-${index}`} className="mt-5 flex gap-3 border-t border-stone-100 pt-5">
          <Lightbulb size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-orange-600" />
          <div className="text-sm leading-6">
            <p className="text-stone-600">{alert.message}</p>
            <p className="mt-2 font-medium text-brand-700">Потенциальная экономия — {formatMoney(alert.potential_saving)}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
