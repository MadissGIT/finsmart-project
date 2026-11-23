import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Check, FileUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { importStatement, validateStatement } from '@/entities/transaction/api';
import type { ImportResult } from '@/entities/transaction/api';
import type { BankHint } from '@/entities/transaction/model/types';
import { useAuth } from '@/features/auth/model/context';
import { getRequestErrorMessage } from '@/shared/api/client';
import { Header } from '@/widgets/app-layout/Header';

export function InitialSetupPage() {
  const input = useRef<HTMLInputElement>(null);
  const auth = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState<BankHint>('auto');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(null); setResult(null);
    const message = validateStatement(selected);
    setError(message ?? '');
    if (!message) setFile(selected);
  }

  async function upload() {
    if (!file) { input.current?.click(); return; }
    if (busy || auth.status !== 'authenticated') return;
    setBusy(true); setError(''); setResult(null);
    try {
      const imported = await importStatement(file, bank);
      setResult(imported); setFile(null);
      if (input.current) input.current.value = '';
    } catch (err) { setError(getRequestErrorMessage(err, 'Не удалось импортировать выписку. Проверьте формат файла.')); }
    finally { setBusy(false); }
  }

  return <div className="initial-setup-page">
    <Header />
    <h1 className="onboarding-title">Давайте настроим<br />Ваш профиль</h1>
    <p className="onboarding-description">Добавьте банковскую выписку, чтобы увидеть свои расходы и распределение бюджета.</p>
    <img className="setup-illustration" src="/illustrations/statement.png" width="230" height="173" alt="Банковская выписка в форматах CSV и XLSX" />
    <div className="onboarding-info statement-info"><FileUp size={25} aria-hidden="true" /><div><h2>Загрузите банковскую выписку</h2><ul>{['CSV или XLSX до 5 МБ', 'Сбер, Т-Банк или ВТБ', 'Операции добавятся в Ваш аккаунт'].map((text) => <li key={text}><Check size={12} aria-hidden="true" />{text}</li>)}</ul></div></div>
    <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Выбрать банковскую выписку" onChange={selectFile} disabled={busy} />
    <div className="form-field mt-4"><label htmlFor="statement-bank">Банк</label><div className="field-control"><select id="statement-bank" value={bank} onChange={(e) => setBank(e.target.value as BankHint)} disabled={busy}><option value="auto">Определить автоматически</option><option value="sber">Сбер</option><option value="tinkoff">Т-Банк</option><option value="vtb">ВТБ</option></select></div></div>
    {auth.status === 'anonymous' ? <p className="file-notice">Для импорта <Link className="inline-link" to="/auth?next=/setup">войдите в аккаунт</Link>.</p> : null}
    {file ? <p className="file-notice" role="status">Выбран файл: <strong>{file.name}</strong>. Нажмите «Импортировать выписку», чтобы отправить его на сервер.</p> : null}
    {error ? <p className="field-error" role="alert">{error}</p> : null}
    {result ? <p className="file-notice" role="status">Импортировано: {result.imported_count}. Распознано операций: {result.total_parsed}. Повторов пропущено: {result.duplicates_skipped}. Строк пропущено: {result.skipped_rows}. Выберите период выписки в обзоре.</p> : null}
    <div className="setup-actions">
      <button className="button-primary" type="button" disabled={busy || (!!file && auth.status !== 'authenticated')} onClick={upload}>{busy ? 'Импортируем…' : file ? 'Импортировать выписку' : 'Выбрать выписку'}</button>
      {file ? <button type="button" className="text-link" disabled={busy} onClick={() => input.current?.click()}>Выбрать другой файл</button> : null}
      <Link className="button-secondary" to="/">Перейти к обзору</Link><Link className="text-link" to="/">Позже</Link>
    </div>
  </div>;
}
