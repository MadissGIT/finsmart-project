import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '@/entities/transaction/model/types';
import { useAuth } from '@/features/auth/model/context';
import { useTransactions } from '@/features/transactions/model/useTransactions';
import { CategoryIcon, TransactionAsset } from '@/features/transactions/ui/CategoryIcon';
import { TransactionCategory } from '@/features/transactions/ui/TransactionCategory';
import { TransactionDelete } from '@/features/transactions/ui/TransactionDelete';
import { TransactionDetails } from '@/features/transactions/ui/TransactionDetails';
import { TransactionFilters } from '@/features/transactions/ui/TransactionFilters';
import { TransactionForm } from '@/features/transactions/ui/TransactionForm';
import { TransactionList } from '@/features/transactions/ui/TransactionList';
import { TransactionSuccess } from '@/features/transactions/ui/TransactionSuccess';
import { getAuthGeneration } from '@/shared/api/tokens';
import './transactions.css';

export function TransactionsPage() {
  const { status } = useAuth();
  return <TransactionsWorkspace key={(status === 'anonymous' ? 'guest-' : 'session-') + getAuthGeneration()} />;
}

function TransactionsWorkspace() {
  const transactions = useTransactions();
  const { status, data, categories, filters, id, search, setSearch } = transactions;
  const [mode, setMode] = useState<'add' | 'edit' | 'category' | 'delete' | 'filters' | null>(() => search.get('add') === '1' ? 'add' : null);
  const [saved, setSaved] = useState<Transaction | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const closeOnHistory = () => { setMode(null); setSaved(null); };
    window.addEventListener('popstate', closeOnHistory);
    return () => window.removeEventListener('popstate', closeOnHistory);
  }, []);
  function changeSearch(fields: Record<string, string>, replace = false) {
    const next = new URLSearchParams(search);
    Object.entries(fields).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    if (!('page' in fields) && !('transaction' in fields)) next.delete('page');
    setSearch(next, { replace });
  }
  function close() { setMode(null); if (search.has('add')) changeSearch({ add: '' }, true); }
  function back() { setMode(null); changeSearch({ transaction: '', add: '' }); }
  function onSaved(item: Transaction) {
    close(); transactions.reload();
    if (mode === 'add') setSaved(item);
    else setNotice('Изменения сохранены.');
  }
  const filtered = !!(filters.q || filters.category_id || filters.operation_type || filters.from_date || filters.to_date);
  return <div className={'transactions-page' + (id ? ' transactions-page-detail' : '')}>
    {!id ? <>
      <div className="transactions-heading"><h1>Транзакции</h1><button type="button" className="transaction-icon-button" aria-label="Открыть фильтры" onClick={() => setMode('filters')} disabled={!categories.length}><TransactionAsset name="76cea.svg" /></button></div>
      <div className="transaction-search"><TransactionAsset name="1daac.svg" /><label htmlFor="transaction-search" className="sr-only">Поиск операций</label><input id="transaction-search" type="search" maxLength={255} placeholder="По организации или описанию" value={search.get('q') ?? ''} onChange={(event) => changeSearch({ q: event.target.value }, true)} /></div>
      {categories.length ? <div className="transaction-category-chips" role="group" aria-label="Фильтр по категории"><button type="button" aria-pressed={!filters.category_id} onClick={() => changeSearch({ category_id: '' })}>Все</button>{categories.map((category) => <button type="button" key={category.id} aria-pressed={filters.category_id === String(category.id)} onClick={() => changeSearch({ category_id: String(category.id) })}><CategoryIcon id={category.id} />{category.name}</button>)}</div> : null}
      {filtered ? <div className="transaction-active-filters"><span>{filters.operation_type === 'CREDIT' ? 'Доходы' : filters.operation_type === 'DEBIT' ? 'Расходы' : 'Все типы'}{filters.from_date || filters.to_date ? ` · ${filters.from_date || 'Начало'} — ${filters.to_date || 'Сегодня и позже'}` : ''}</span><button type="button" className="inline-link" onClick={() => { setSearch(new URLSearchParams()); }}>Сбросить</button></div> : null}
    </> : null}
    {status === 'anonymous' ? <div className="transactions-empty"><h2>Ваши операции появятся после входа</h2><p>Войдите, чтобы добавить доход или расход и загрузить банковскую выписку.</p><Link className="button-primary" to="/auth?next=/transactions">Войти</Link></div> : status === 'loading' ? <div className="transaction-loading" role="status">Загружаем операции…<div /><div /><div /></div> : status === 'error' ? <div className="transactions-empty"><p className="transaction-error" role="alert">{transactions.error}</p><button type="button" className="button-primary" onClick={transactions.reload}>Повторить загрузку</button><button type="button" className="text-link" onClick={() => setSearch(new URLSearchParams())}>К списку без фильтров</button></div> : data ? <>
      {data.detail ? <TransactionDetails item={data.detail} onBack={back} onEdit={() => setMode('edit')} onCategory={() => setMode('category')} onDelete={() => setMode('delete')} /> : <>
        {data.items.length ? <TransactionList items={data.items} search={search} /> : <div className="transactions-empty"><h2>{filtered || filters.page > 1 ? 'Операции не найдены' : 'Операций пока нет'}</h2><p>{filtered ? 'Попробуйте изменить поиск или фильтры.' : 'Добавьте первую операцию или загрузите выписку.'}</p>{!filtered ? <button type="button" className="button-primary" onClick={() => setMode('add')}>Добавить операцию</button> : null}<Link className="button-secondary" to="/setup">Загрузить выписку</Link></div>}
        <div className="transaction-pagination"><p>Суммы по дням рассчитаны по операциям на этой странице.</p><nav aria-label="Страницы операций"><button className="button-secondary" type="button" disabled={filters.page === 1} onClick={() => changeSearch({ page: String(filters.page - 1) })}>Назад</button><span>Страница {filters.page}</span><button className="button-secondary" type="button" disabled={!data.hasNext} onClick={() => changeSearch({ page: String(filters.page + 1) })}>Далее</button></nav></div>
        <div className="transaction-floating-actions"><Link to="/setup" aria-label="Загрузить банковскую выписку"><TransactionAsset name="4f26d.svg" /></Link><button type="button" aria-label="Добавить операцию" onClick={() => setMode('add')}><TransactionAsset name="c46ca.svg" /></button></div>
      </>}
      {mode === 'add' || (mode === 'edit' && data.detail) ? <TransactionForm key={mode + (data.detail?.id ?? '')} categories={data.categories} original={mode === 'edit' ? data.detail ?? undefined : undefined} onClose={close} onSaved={onSaved} /> : null}
      {mode === 'category' && data.detail ? <TransactionCategory item={data.detail} categories={data.categories} onClose={close} onSaved={() => { close(); transactions.reload(); setNotice('Категория обновлена.'); }} /> : null}
      {mode === 'delete' && data.detail ? <TransactionDelete item={data.detail} onClose={close} onDeleted={() => { close(); back(); transactions.reload(); setNotice('Операция удалена.'); }} /> : null}
      {saved ? <TransactionSuccess item={saved} onClose={() => setSaved(null)} onView={() => { changeSearch({ transaction: saved.id }); setSaved(null); }} /> : null}
    </> : null}
    {mode === 'filters' && categories.length ? <TransactionFilters filters={filters} categories={categories} onClose={close} onApply={(fields) => { changeSearch(fields); close(); }} /> : null}
    {notice ? <p className="transaction-notice" role="status">{notice}</p> : null}
    {id && status !== 'ready' ? <button className="text-link transaction-error-back" type="button" onClick={back}>К списку транзакций</button> : null}
  </div>;
}
