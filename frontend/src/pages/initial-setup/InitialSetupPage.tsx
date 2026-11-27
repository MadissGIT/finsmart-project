import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
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
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const auth = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState<BankHint>('auto');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function selectFiles(files: FileList | null) {
    if (busy || !files?.length) return;
    const message = files.length === 1 ? validateStatement(files[0]) : 'Добавляйте по одной выписке за раз.';
    setResult(null);
    setError(message ?? '');
    setFile(message ? null : files[0]);
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    selectFiles(event.currentTarget.files);
    event.currentTarget.value = '';
  }

  function enterDropzone(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    if (busy) return;
    // При переходе на вложенный элемент браузер генерирует пару enter/leave.
    dragDepth.current += 1;
    setDragging(true);
  }

  function leaveDropzone() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function allowDrop(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
  }

  function dropStatement(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    selectFiles(event.dataTransfer.files);
  }

  async function upload() {
    if (!file) { input.current?.click(); return; }
    if (busy || auth.status !== 'authenticated') return;
    dragDepth.current = 0;
    setDragging(false);
    setBusy(true); setError(''); setResult(null);
    try {
      const imported = await importStatement(file, bank);
      setResult(imported); setFile(null);
    } catch (err) { setError(getRequestErrorMessage(err, 'Не удалось импортировать выписку. Проверьте формат файла.')); }
    finally { setBusy(false); }
  }

  return <div className="initial-setup-page">
    <Header />
    <h1 className="onboarding-title">Давайте настроим<br />Ваш профиль</h1>
    <p className="onboarding-description">Добавьте банковскую выписку, чтобы увидеть свои расходы и распределение бюджета.</p>
    <img className="setup-illustration" src="/illustrations/statement.webp" width="230" height="173" alt="Банковская выписка в форматах CSV и XLSX" />
    <section
      className="onboarding-info statement-info statement-dropzone"
      aria-labelledby="statement-title"
      data-dragging={dragging}
      onDragEnter={enterDropzone}
      onDragLeave={leaveDropzone}
      onDragOver={allowDrop}
      onDrop={dropStatement}
    >
      <FileUp size={25} aria-hidden="true" />
      <div>
        <h2 id="statement-title">Загрузите банковскую выписку</h2>
        <p className="statement-drop-hint">Перетащите файл сюда или выберите его кнопкой ниже.</p>
        <ul>
          {['CSV или XLSX до 5 МБ', 'Сбер, Т-Банк или ВТБ'].map((text) => (
            <li key={text}><Check size={12} aria-hidden="true" />{text}</li>
          ))}
        </ul>
      </div>
    </section>
    <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Выбрать банковскую выписку" tabIndex={-1} onChange={selectFile} disabled={busy} />
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
