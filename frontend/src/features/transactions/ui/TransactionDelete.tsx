import type { Transaction } from '@/entities/transaction/model/types';
import { deleteTransaction } from '@/entities/transaction/transactions-api';
import { formatMoney } from '@/shared/lib/format';
import { useTransactionMutation } from '../model/useTransactionMutation';
import { TransactionSheet } from './TransactionSheet';

export function TransactionDelete({ item, onClose, onDeleted }: { item: Transaction; onClose: () => void; onDeleted: () => void }) {
  const mutation = useTransactionMutation();
  return <TransactionSheet title="Удалить операцию?" variant="center" busy={mutation.busy} onClose={onClose}><p className="transaction-confirm-text">{item.merchant_name} · {formatMoney(item.amount)}. Операция исчезнет из списка и расчётов за её период.</p><div className="transaction-rule-actions"><button type="button" className="button-secondary" disabled={mutation.busy} onClick={onClose}>Отмена</button><button type="button" className="button-primary transaction-danger-button" disabled={mutation.busy} onClick={() => { void mutation.run(() => deleteTransaction(item.id), onDeleted); }}>{mutation.busy ? 'Удаляем…' : 'Удалить'}</button></div>{mutation.error ? <p className="transaction-error" role="alert">{mutation.error}</p> : null}</TransactionSheet>;
}
