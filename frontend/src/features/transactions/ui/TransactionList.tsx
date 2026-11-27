import { Link } from 'react-router-dom';
import type { Transaction } from '@/entities/transaction/model/types';
import { formatMoney } from '@/shared/lib/format';
import { dayLabel, groupTransactions, transactionTime } from '../model/transactions';
import { categoryColor, formatTransactionTitle } from '../model/presentation';
import { CategoryIcon, TransactionAsset } from './CategoryIcon';

export function TransactionList({ items, search }: { items: Transaction[]; search: URLSearchParams }) {
  return <div className="transaction-groups">{groupTransactions(items).map((group) => <section key={group.day} aria-label={dayLabel(group.day)}>
    <div className="transaction-day-heading"><h2>{dayLabel(group.day)}</h2><span title="Итог показанных операций за день" className={group.cents > 0 ? 'transaction-income' : undefined}>{group.cents > 0 ? '+' : ''}{formatMoney(group.cents / 100)}</span></div>
    <ul>{group.items.map((item) => {
      const params = new URLSearchParams(search); params.set('transaction', item.id); params.delete('add');
      return <li key={item.id}><Link className="transaction-row" to={'/transactions?' + params.toString()}>
        <CategoryIcon id={item.category_id} /><span className="transaction-row-description"><span>{formatTransactionTitle(item.merchant_name)}</span><span className="transaction-row-category"><span className="transaction-color-dot" style={{ background: categoryColor(item.category_id) }} />{item.category_name}{item.requires_review ? <span aria-label="Нужно проверить категорию"> · ?</span> : null}</span></span>
        <time dateTime={item.transaction_date}>{transactionTime(item.transaction_date)}</time><strong className={item.operation_type === 'CREDIT' ? 'transaction-income' : undefined}>{item.operation_type === 'DEBIT' ? '−' : '+'}{formatMoney(item.amount)}</strong><TransactionAsset name="bef84.svg" />
      </Link></li>;
    })}</ul>
  </section>)}</div>;
}
