import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { listContributions } from '@/entities/goal/api';
import { contributionSources } from '@/features/goals/model/goals';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { financialTimezone } from '@/shared/lib/calendar';
import { formatMoney } from '@/shared/lib/format';

const timestamp = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: financialTimezone });

export function GoalHistory({ id }: { id: string }) {
  const [page, setPage] = useState(0);
  const load = useCallback((signal: AbortSignal) => listContributions(id, page, signal), [id, page]);
  const history = useApiQuery(load);

  return (
    <section className="goal-history" aria-labelledby="goal-history-title">
      <h2 id="goal-history-title">История пополнений</h2>
      {history.loading && <p className="goal-muted" role="status">Загружаем взносы…</p>}
      {history.error && <div className="goal-state">
        <p className="goal-error" role="alert">{history.error}</p>
        <button className="button-secondary" onClick={history.retry}>Повторить загрузку взносов</button>
      </div>}
      {history.data && <>
        {history.data.items.length === 0
          ? <p className="goal-muted">Пополнений пока нет.</p>
          : <ul>
            {history.data.items.map((item) => <li key={item.id} className="goal-history-row">
              <span className="goal-history-icon"><Plus size={16} aria-hidden="true" /></span>
              <div><time dateTime={item.created_at}>{timestamp.format(new Date(item.created_at))}</time><span>{contributionSources[item.source]}</span></div>
              <strong>+{formatMoney(item.amount)}</strong>
            </li>)}
          </ul>}
        {(page > 0 || history.data.hasNext) && <nav className="goal-history-pagination" aria-label="Страницы истории">
          <button className="button-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button>
          <span>Страница {page + 1}</span>
          <button className="button-secondary" disabled={!history.data.hasNext} onClick={() => setPage(page + 1)}>Далее</button>
        </nav>}
      </>}
    </section>
  );
}
