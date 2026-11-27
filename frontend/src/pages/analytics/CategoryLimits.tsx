import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { getCategories } from '@/entities/category/api';
import { removeCategoryLimit, saveCategoryLimit } from '@/entities/limit/api';
import { useNotifications } from '@/features/notifications/model/context';
import { getRequestErrorMessage } from '@/shared/api/client';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { formatMoney } from '@/shared/lib/format';

export function CategoryLimits() {
  const formId = useId();
  const categories = useApiQuery(getCategories);
  const { limits } = useNotifications();
  const section = useRef<HTMLElement>(null);
  const { hash, key } = useLocation();
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hash !== '#category-limits') return;
    const frame = requestAnimationFrame(() => {
      section.current?.focus({ preventScroll: true });
      section.current?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await saveCategoryLimit(category, amount);
      setAmount('');
    } catch (err) {
      setError(getRequestErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: number) {
    setPending(true);
    setError('');
    try {
      await removeCategoryLimit(id);
    } catch (err) {
      setError(getRequestErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return <section ref={section} id="category-limits" tabIndex={-1} className="panel scroll-mt-4 print:hidden" aria-labelledby={formId + "-title"}>
    <h2 id={formId + "-title"} className="font-semibold">Лимиты текущего месяца</h2>
    <form className="my-4 flex flex-wrap items-end gap-3" onSubmit={(event) => void save(event)}>
      <div><label htmlFor={formId + "-category"}>Категория</label>
        <select id={formId + "-category"} className="block border p-2" required value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Выберите категорию</option>
          {categories.data?.filter((item) => item.budget_group !== 'INCOME').map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>
      <div><label htmlFor={formId + "-amount"}>Лимит, ₽</label>
        <input id={formId + "-amount"} className="block border p-2" required type="number" step="0.01" min="0.01" max="999999999999.99"
          value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <button className="button-primary" type="submit" disabled={pending || categories.loading}>Сохранить лимит</button>
    </form>
    {(error || limits.error || categories.error) && <p role="alert">{error || limits.error || categories.error}</p>}
    {limits.error && <button type="button" onClick={limits.retry}>Повторить загрузку лимитов</button>}
    {limits.loading && !limits.data && <p role="status">Загружаем лимиты…</p>}
    <ul className="grid gap-3">
      {limits.data?.items.map((item) => <li key={item.category_id} className="rounded border p-3">
        <div className="flex flex-wrap justify-between gap-2">
          <strong>{item.category_name}</strong>
          <button type="button" disabled={pending} aria-label={'Удалить лимит ' + item.category_name}
            onClick={() => void remove(item.category_id)}>Удалить</button>
        </div>
        <progress aria-label={'Расход по категории ' + item.category_name}
          value={Math.min(item.percent, 100)} max={100} className="w-full" />
        <p>{formatMoney(item.spent)} из {formatMoney(item.amount)} · {item.percent}%</p>
        {item.status !== 'ok' && <p role="status">{item.status === 'reached'
          ? 'Лимит достигнут' : 'Израсходовано не менее 80% лимита'}</p>}
      </li>)}
    </ul>
  </section>;
}
