import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { BarChart3, Download, FileText, UserRound, UsersRound } from 'lucide-react';
import { Modal } from '@/shared/ui/Modal';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { AdminLoad, Pager, TextArea } from './AdminUi';
import { blockUser, downloadAttachment, getAnalytics, getTickets, getUsers, pageSize, saveAdminRow } from './api';
import type { AdminTicket, AdminUser } from './api';
import { displayDate, text } from './format';

const roles = { admin: 'Администратор', moderator: 'Модератор', user: 'Пользователь' };
const ticketStatuses = { open: 'Открыто', answered: 'Есть ответ', closed: 'Закрыто' };
const numbers = new Intl.NumberFormat('ru-RU');

export function UsersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<AdminUser | null>(null);
  const load = useCallback((signal: AbortSignal) => getUsers(signal, search, page), [search, page]);
  const query = useApiQuery(load);
  const mutation = useApiMutation();

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(text(new FormData(event.currentTarget), 'q'));
    setPage(0);
  }

  function confirm() {
    if (!pending) return;
    void mutation.run(() => blockUser(pending.id, pending.blocked_at === null), () => {
      query.retry();
      setPending(null);
    });
  }

  return <>
    <header className="admin-page-heading"><h1>Пользователи</h1></header>
    <form className="admin-toolbar" role="search" onSubmit={filter}>
      <input name="q" type="search" placeholder="Имя или email" aria-label="Имя или email" maxLength={100} />
      <button className="admin-button" type="submit">Найти</button>
    </form>
    <AdminLoad {...query} />
    {query.data && <>
      <div className="admin-panel admin-table-wrap">
        <table className="admin-table">
          <thead><tr>
            <th>Пользователь</th><th>Роль и доступ</th><th>Регистрация</th>
            <th>Последняя активность</th><th>Операций</th><th>Выписок</th><th>Копилок</th><th>Действие</th>
          </tr></thead>
          <tbody>{query.data.map((user) => <tr key={user.id}>
            <td><strong>{user.full_name}</strong><small>{user.email}</small></td>
            <td>{roles[user.role]}<small>{user.blocked_at ? 'Заблокирован' : 'Доступ открыт'}</small></td>
            <td>{displayDate(user.created_at)}</td><td>{displayDate(user.last_activity)}</td>
            <td>{user.operations}</td><td>{user.imports}</td><td>{user.goals}</td>
            <td>{user.role === 'admin' ? '—' : <button className="admin-button" type="button"
              onClick={() => setPending(user)}>{user.blocked_at ? 'Разблокировать' : 'Заблокировать'}</button>}</td>
          </tr>)}</tbody>
        </table>
        {!query.data.length && <p className="admin-empty">Пользователи не найдены</p>}
      </div>
      <Pager page={page} next={query.data.length === pageSize} onChange={setPage} />
    </>}
    <Modal open={pending !== null} title={pending?.blocked_at ? 'Разблокировать аккаунт?' : 'Заблокировать аккаунт?'}
      busy={mutation.busy} onClose={() => setPending(null)}>
      {pending && <>
        <p><strong>{pending.full_name}</strong> · {pending.email}</p>
        <p>{pending.blocked_at ? 'Пользователь снова сможет войти.' : 'Текущие сессии завершатся. Данные аккаунта сохранятся.'}</p>
        {mutation.error && <p className="admin-error" role="alert">{mutation.error}</p>}
        <button className="admin-button admin-primary" type="button" disabled={mutation.busy} onClick={confirm}>
          {pending.blocked_at ? 'Разблокировать' : 'Заблокировать'}
        </button>
      </>}
    </Modal>
  </>;
}

export function AnalyticsPage() {
  const query = useApiQuery(getAnalytics);
  const data = query.data;
  return <>
    <header className="admin-page-heading"><h1>Сводка</h1>
      <button type="button" className="admin-button" disabled={query.loading} onClick={query.retry}>Обновить</button>
    </header>
    <AdminLoad {...query} />
    {data && <>
      <dl className="admin-metrics">
        <div><UsersRound size={21} /><dt>Зарегистрировано</dt><dd>{numbers.format(data.profiles)}</dd></div>
        <div><UserRound size={21} /><dt>Доступ открыт</dt><dd>{numbers.format(data.active_accounts)}</dd></div>
        <div><FileText size={21} /><dt>Загружено выписок</dt><dd>{numbers.format(data.imports)}</dd></div>
        <div><BarChart3 size={21} /><dt>Средний процент распознавания</dt>
          <dd>{data.recognition_percent === null ? '—' : numbers.format(data.recognition_percent) + '%'}</dd></div>
      </dl>
      <p className="admin-muted">Статистика выписок собирается с момента установки обновления.</p>
      <section className="admin-panel admin-goals">
        <h2>Популярные типы копилок</h2>
        {!Object.keys(data.popular_goals).length && <p className="admin-empty">Пока нет копилок.</p>}
        {Object.entries(data.popular_goals).map(([label, count]) => <div key={label}><span>{label}</span>
          <strong>{numbers.format(count)}</strong></div>)}
      </section>
    </>}
  </>;
}

function TicketEditor({ ticket, onSaved }: { ticket: AdminTicket; onSaved: () => void }) {
  const mutation = useApiMutation();
  const download = useApiMutation();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { status: text(form, 'status'), reply: text(form, 'reply') || null };
    void mutation.run(() => saveAdminRow<void>('tickets', ticket.id, payload), onSaved);
  }
  return <div className="admin-ticket-content">
    <h2>{ticket.email}</h2>
    <p className="admin-muted">{displayDate(ticket.created_at)} · {ticket.id}</p>
    <p className="admin-ticket-message">{ticket.message}</p>
    {ticket.attachment_name && <button type="button" className="admin-button" disabled={download.busy}
      onClick={() => {
        void download.run(() => downloadAttachment(ticket.id, ticket.attachment_name!), () => undefined);
      }}><Download size={16} />{ticket.attachment_name}</button>}
    {download.error && <p className="admin-error" role="alert">{download.error}</p>}
    <form onSubmit={submit} className="admin-editor" aria-busy={mutation.busy}>
      <fieldset disabled={mutation.busy}>
        <TextArea label="Ответ пользователю" name="reply" defaultValue={ticket.reply ?? ''} rows={6} maxLength={4000} />
        <label>Статус<select name="status" defaultValue={ticket.status}>
          {Object.entries(ticketStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </fieldset>
      {mutation.error && <p className="admin-error" role="alert">{mutation.error}</p>}
      <button className="admin-button admin-primary" type="submit" disabled={mutation.busy}>Сохранить ответ</button>
    </form>
  </div>;
}

export function TicketsPage() {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [saved, setSaved] = useState(false);
  const load = useCallback((signal: AbortSignal) => getTickets(signal, page), [page]);
  const query = useApiQuery(load, true, true);
  const ticket = query.data?.find(({ id }) => id === selected);
  return <>
    <header className="admin-page-heading"><h1>Обращения</h1></header>
    <AdminLoad loading={query.loading && !query.data} error={query.error} retry={query.retry} />
    {saved && <p className="admin-success" role="status">Обращение обновлено</p>}
    {query.data && <>
      <div className="admin-collection">
        <div className="admin-panel admin-list">
          {!query.data.length && <p className="admin-empty">Пока нет обращений</p>}
          {query.data.map((item) => <button key={item.id} type="button" aria-pressed={item.id === selected}
            onClick={() => { setSelected(item.id); setSaved(false); }}>
            <span><strong>{item.email}</strong><small>{item.message.slice(0, 80)}</small></span>
            <span className="admin-tag">{ticketStatuses[item.status]}</span>
          </button>)}
        </div>
        <section className="admin-panel admin-edit-panel">{ticket
          ? <TicketEditor key={ticket.id} ticket={ticket} onSaved={() => { query.retry(); setSaved(true); }} />
          : <p className="admin-empty">Выберите обращение.</p>}</section>
      </div>
      <Pager page={page} next={query.data.length === pageSize} onChange={(value) => {
        setPage(value); setSelected(undefined); setSaved(false);
      }} />
    </>}
  </>;
}
