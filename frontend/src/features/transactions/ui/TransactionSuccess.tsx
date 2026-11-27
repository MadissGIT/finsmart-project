import type { Transaction } from '@/entities/transaction/model/types';
import { formatMoney } from '@/shared/lib/format';
import { formatTransactionTitle } from '../model/presentation';
import { dayLabel, transactionDay } from '../model/transactions';
import { CategoryIcon, TransactionAsset } from './CategoryIcon';
import { TransactionSheet } from './TransactionSheet';

export function TransactionSuccess({ item, onClose, onView }: { item: Transaction; onClose: () => void; onView: () => void }) {
  return <TransactionSheet title="Операция сохранена" onClose={onClose}><div className="transaction-success">
    <div className="transaction-success-illustration"><TransactionAsset name="55a7d.png" /></div><h3>{item.operation_type === 'DEBIT' ? 'Расход добавлен' : 'Доход добавлен'}</h3>
    <div className="transaction-success-summary"><CategoryIcon id={item.category_id} picker /><span><strong>{formatTransactionTitle(item.merchant_name)}</strong><small>{item.category_name}</small></span><span><strong>{item.operation_type === 'DEBIT' ? '−' : '+'}{formatMoney(item.amount)}</strong><small>{dayLabel(transactionDay(item.transaction_date))}</small></span></div>
    <button type="button" className="button-primary" onClick={onClose}>Продолжить</button><button type="button" className="text-link" onClick={onView}>Посмотреть операцию</button>
  </div></TransactionSheet>;
}
