import { useCallback, useState } from 'react';
import { BadgeCheck, CircleAlert, Tag, TriangleAlert, Wallet, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDiagnosis } from '@/entities/analytics/api';
import type { DiagnosticAlert, FinancialDiagnosis } from '@/entities/analytics/model/types';
import { diagnosisRange, formatRange } from '@/features/dashboard/model/period';
import type { DateRange } from '@/features/dashboard/model/period';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { financialToday } from '@/shared/lib/calendar';
import { formatMoney } from '@/shared/lib/format';
import './diagnostics.css';

const indices = [
  ['balance', 'Баланс'],
  ['budget', 'Бюджет'],
  ['goals', 'Копилки'],
  ['regularity', 'Учёт операций'],
] as const;

function HealthScore({ diagnosis }: { diagnosis: FinancialDiagnosis }) {
  const { health_score: score, color, status, unavailable } = diagnosis;
  return (
    <>
      <div className="diagnosis-health">
        <div
          className="health-ring"
          role="meter"
          aria-label="Рейтинг финансового здоровья"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ background: `conic-gradient(${color} ${score}%, #ebeaf4 0)` }}
        >
          <span className="health-ring-inner" aria-hidden="true"><strong>{score}</strong><small>/100</small></span>
        </div>
        <p>{status}</p>
      </div>
      <details className="diagnosis-indices">
        <summary>Из чего складывается рейтинг</summary>
        <dl>
          {indices.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{diagnosis.indices[key].toLocaleString('ru-RU', { maximumFractionDigits: 1 })} / 100</dd>
            </div>
          ))}
        </dl>
        {Object.entries(unavailable).map(([type, reason]) => <p key={type}>{reason}.</p>)}
      </details>
    </>
  );
}

function AlertCard({ alert, onHide }: { alert: DiagnosticAlert; onHide: () => void }) {
  const today = financialToday();
  const offers = alert.discounts.filter(({ valid_until }) => valid_until >= today);
  const tone = alert.badge ? 'positive' : alert.type === 'FD-05' ? 'urgent' : 'warning';
  const Icon = alert.badge ? BadgeCheck : alert.type === 'FD-05' ? Wallet : TriangleAlert;

  return (
    <li className="diagnosis-alert-group">
      <article className={'diagnosis-alert diagnosis-alert--' + tone}>
        <span className="diagnosis-alert-icon"><Icon size={18} aria-hidden="true" /></span>
        <div className="diagnosis-alert-copy">
          <h4>{alert.title}</h4>
          <p>{alert.message}</p>
          <p>{alert.recommendation}</p>
          {alert.potential_saving > 0 && <p className="diagnosis-saving">Возможная экономия — {formatMoney(alert.potential_saving)}</p>}
        </div>
        <button className="diagnosis-hide" type="button" aria-label={'Скрыть «' + alert.title + '»'} onClick={onHide}><X size={16} aria-hidden="true" /></button>
      </article>
      {offers.length > 0 && (
        <div className="diagnosis-offers">
          <div>
            <h4>Скидки в категории «{alert.category}»</h4>
            <ul>
              {offers.map((offer) => (
                <li key={offer.id}>
                  <Link to={'/discounts?offer=' + offer.id}>
                    {offer.partner_name} · {offer.benefit || offer.title}
                    {offer.is_demo && <small>Демо</small>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {alert.type === 'FD-03'
            ? <img src="/figma/discounts/category-promo.png" alt="" width={76} />
            : <span className="diagnosis-offer-icon"><Tag size={23} aria-hidden="true" /></span>}
        </div>
      )}
    </li>
  );
}

export function Diagnostics({ range }: { range: DateRange }) {
  const { from, to } = diagnosisRange(range);
  const load = useCallback((signal: AbortSignal) => getDiagnosis({ from, to }, signal), [from, to]);
  const query = useApiQuery(load);
  const [hidden, setHidden] = useState<string[]>([]);
  const diagnosis = query.data?.diagnostics;
  const summary = query.data?.summary;
  const hasOperations = !!summary && (summary.total_income > 0 || summary.total_expense > 0);

  return (
    <section className="panel diagnosis-panel" aria-labelledby="diagnosis-title" aria-busy={query.loading}>
      <h2 id="diagnosis-title">Финансовое здоровье</h2>
      {query.loading && <p className="diagnosis-note" role="status">Рассчитываем финансовый диагноз…</p>}
      {query.error && (
        <div className="diagnosis-error">
          <p role="alert"><CircleAlert size={17} aria-hidden="true" />{query.error}</p>
          <button type="button" className="button-secondary" onClick={query.retry}>Повторить расчёт</button>
        </div>
      )}
      {query.data && diagnosis && (
        <>
          <p className="diagnosis-note">
            {formatRange(query.data.period)}{from !== range.from && ' · последние 31 день выбранного периода'}
          </p>
          {hasOperations ? (
            <>
              <HealthScore diagnosis={diagnosis} />
              {diagnosis.alerts.length > 0 ? (
                <div className="diagnosis-alerts">
                  <h3>Рекомендации</h3>
                  <ul>
                    {diagnosis.alerts.filter(({ type }) => !hidden.includes(type)).map((alert) => (
                      <AlertCard key={alert.type} alert={alert} onHide={() => setHidden((ids) => [...ids, alert.type])} />
                    ))}
                  </ul>
                  {hidden.length > 0 && <button type="button" className="inline-link" onClick={() => setHidden([])}>Показать скрытые ({hidden.length})</button>}
                </div>
              ) : <p className="diagnosis-note">За этот период предупреждений нет.</p>}
            </>
          ) : <p className="diagnosis-note">Рейтинг появится, когда за этот период будут доходы или расходы.</p>}
        </>
      )}
    </section>
  );
}
