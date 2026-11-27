import { ArrowLeft, Headphones, Paperclip } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getSupportTickets, maxSupportAttachmentBytes, sendSupportTicket, supportAttachmentTypes } from '@/entities/support/api';
import { useAuth } from '@/features/auth/model/context';
import { ApiStatus } from '@/features/check-api/ApiStatus';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { useApiMutation } from '@/shared/api/useApiMutation';
import './support.css';

function SupportForm({ onCreated }: { onCreated: () => void }) {
  const mutation = useApiMutation();
  const request = useRef<{ message: string; file: File | null; id: string }>();
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [ticket, setTicket] = useState('');
  const messageId = useId();

  function attach(input: HTMLInputElement) {
    const next = input.files?.[0] ?? null;
    input.value = '';
    if (!next) return;
    if (!supportAttachmentTypes.includes(next.type) || next.size === 0 || next.size > maxSupportAttachmentBytes) {
      setFileError('Выберите непустой PDF, PNG или JPEG до 2 МБ.');
      return;
    }
    setFileError('');
    setFile(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || mutation.busy || fileError) return;
    if (request.current?.message !== text || request.current.file !== file) {
      request.current = { message: text, file, id: crypto.randomUUID() };
    }
    const id = request.current.id;
    void mutation.run(() => sendSupportTicket(text, id, file), (created) => {
      setTicket(created);
      onCreated();
      setMessage('');
      setFile(null);
      request.current = undefined;
    });
  }

  return ticket ? (
    <section className="more-state support-ticket" aria-live="polite">
      <h2>Запрос отправлен</h2>
      <p>Номер обращения</p><code>{ticket}</code>
      <button className="button-secondary" type="button" onClick={() => setTicket('')}>Написать ещё</button>
    </section>
  ) : (
    <form className="support-form" onSubmit={submit} aria-busy={mutation.busy}>
      <label className="sr-only" htmlFor={messageId}>Опишите проблему</label>
      <textarea id={messageId} placeholder="Опишите проблему…" rows={4} maxLength={4000} required
        value={message} onChange={(event) => setMessage(event.target.value)} disabled={mutation.busy} />
      <label className="support-attachment">
        <Paperclip size={19} aria-hidden="true" />
        <span>Прикрепить файл<small>PDF, PNG или JPEG до 2 МБ</small></span>
        <input type="file" accept={supportAttachmentTypes.join(',')} disabled={mutation.busy}
          onChange={(event) => attach(event.target)} />
      </label>
      {file && <div className="support-selected-file">
        <span>{file.name}</span>
        <button type="button" className="inline-link" disabled={mutation.busy}
          onClick={() => { setFile(null); setFileError(''); }}>Убрать файл</button>
      </div>}
      {fileError && <div>
        <p className="field-error" role="alert">{fileError}</p>
        {!file && <button className="inline-link" type="button" onClick={() => setFileError('')}>
          Продолжить без файла
        </button>}
      </div>}
      {mutation.error && <p className="field-error" role="alert">{mutation.error}</p>}
      <button className="button-primary" type="submit" disabled={!message.trim() || mutation.busy || !!fileError}>
        {mutation.busy ? 'Отправляем…' : 'Отправить запрос'}
      </button>
    </form>
  );
}

const statuses = { open: 'Открыто', answered: 'Есть ответ', closed: 'Закрыто' };

function SupportAccount() {
  const [open, setOpen] = useState(false);
  const { data, error, loading, retry } = useApiQuery(getSupportTickets, open, true);
  return <>
    <SupportForm onCreated={retry} />
    <details className="support-history" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Мои обращения</summary>
      {loading && !data && <p role="status">Загружаем обращения…</p>}
      {error && <><p role="alert">{error}</p><button className="button-secondary" type="button" onClick={retry}>Повторить</button></>}
      {data?.length === 0 && <p>Обращений пока нет</p>}
      {data?.map((ticket) => <article key={ticket.id}>
        <small>{statuses[ticket.status]}</small>
        <p>{ticket.message}</p>
        {ticket.reply && <div><strong>Ответ поддержки</strong><p>{ticket.reply}</p></div>}
      </article>)}
    </details>
  </>;
}

export function SupportPage() {
  const { status, user } = useAuth();

  return (
    <div className="more-page support-page">
      <Link className="icon-button support-back" to="/more" aria-label="Назад">
        <ArrowLeft size={22} aria-hidden="true" />
      </Link>
      <div className="support-heading">
        <span className="more-info-icon" aria-hidden="true"><Headphones size={58} /></span>
        <h1>Написать в поддержку</h1>
        <p>Опишите проблему или задайте вопрос</p>
      </div>
      {user ? <SupportAccount key={user.id} /> : <>
        {status === 'loading' ? <p role="status">Загружаем профиль…</p> : (
          <Link className="button-primary" to="/auth?next=/more/support">Войти, чтобы отправить запрос</Link>
        )}
        <Link className="text-link" to="/more/faq">Частые вопросы</Link>
        <ApiStatus />
      </>}
    </div>
  );
}
