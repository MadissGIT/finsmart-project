import { useState } from 'react';
import type { Transaction } from '@/entities/transaction/model/types';
import { financialTimezone } from '@/shared/lib/calendar';
import { formatMoney } from '@/shared/lib/format';
import { categoryColor, formatTransactionTitle } from '../model/presentation';
import { CategoryIcon, TransactionAsset, TransactionHero } from './CategoryIcon';

export function TransactionDetails({ item, onBack, onEdit, onCategory, onDelete }: { item: Transaction; onBack: () => void; onEdit: () => void; onCategory: () => void; onDelete: () => void }) {
  const [notice, setNotice] = useState('');
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('Ссылка на операцию скопирована.'); }
    catch { setNotice('Ссылку на операцию можно скопировать из адресной строки.'); }
  }
  const date = new Intl.DateTimeFormat('ru-RU', { timeZone: financialTimezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.transaction_date));
  return <article className="transaction-detail">
    <div className="transaction-detail-toolbar"><button type="button" className="transaction-icon-button" onClick={onBack} aria-label="К списку транзакций"><TransactionAsset name="de43d.svg" /></button><button type="button" className="transaction-icon-button" onClick={copyLink} aria-label="Скопировать ссылку на операцию"><TransactionAsset name="51c77.svg" /></button></div>
    <TransactionHero categoryId={item.category_id} />
    <h1 className={item.operation_type === 'CREDIT' ? 'transaction-income' : undefined}>{item.operation_type === 'CREDIT' ? '+' : '−'}{formatMoney(item.amount)}</h1><p className="transaction-detail-date">{date}</p>
    <button className="transaction-detail-category" type="button" onClick={onCategory} aria-label="Изменить категорию"><CategoryIcon id={item.category_id} /><span><strong>{formatTransactionTitle(item.merchant_name)}</strong><span><span className="transaction-color-dot" style={{ background: categoryColor(item.category_id) }} />{item.category_name}</span></span></button>
    {item.requires_review ? <p className="transaction-error">Проверьте категорию этой операции.</p> : null}
    <div className="transaction-detail-comment"><h2>Комментарий</h2><p>{item.comment || 'Комментария нет'}</p></div>
    <p className="transaction-muted">{item.bank_source === 'MANUAL' ? 'Добавлено вручную' : 'Импорт из ' + ({ SBER: 'Сбера', TBANK: 'Т-Банка', VTB: 'ВТБ' }[item.bank_source])}</p>
    <div className="transaction-detail-actions"><button className="button-secondary" type="button" onClick={onEdit}>Редактировать</button><button className="button-secondary transaction-delete" type="button" onClick={onDelete}>Удалить</button></div>
    {notice ? <p className="transaction-muted" role="status">{notice}</p> : null}
  </article>;
}
