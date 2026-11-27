import { useState } from 'react';
import type { FormEvent, ReactNode, TextareaHTMLAttributes } from 'react';
import { Plus } from 'lucide-react';
import { useApiMutation } from '@/shared/api/useApiMutation';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { saveAdminRow } from './api';

export function AdminLoad({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  if (error) return <div className="admin-error" role="alert">
    <p>{error}</p><button type="button" className="admin-button" onClick={retry}>Повторить</button>
  </div>;
  return loading ? <p role="status" className="admin-muted">Загружаем…</p> : null;
}

export function Pager({ page, next, onChange }: { page: number; next: boolean; onChange: (page: number) => void }) {
  return <nav className="admin-pager" aria-label="Страницы">
    <button className="admin-button" type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>Назад</button>
    <span>Страница {page + 1}</span>
    <button className="admin-button" type="button" disabled={!next} onClick={() => onChange(page + 1)}>Далее</button>
  </nav>;
}

export function AdminEditor<T>({ resource, row, getId, fields, payload, onSaved, onCancel }: {
  resource: string;
  row: T | undefined;
  getId: (row: T) => string | number;
  fields: ReactNode;
  payload: (form: FormData, row?: T) => object;
  onSaved: (row: T) => void;
  onCancel: () => void;
}) {
  const mutation = useApiMutation();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = payload(new FormData(event.currentTarget), row);
    void mutation.run(() => saveAdminRow<T>(resource, row ? getId(row) : undefined, values), onSaved);
  }
  return <form onSubmit={submit} className="admin-editor" aria-busy={mutation.busy}>
    <fieldset disabled={mutation.busy}>{fields}</fieldset>
    {mutation.error && <p className="admin-error" role="alert">{mutation.error}</p>}
    <div className="admin-actions">
      <button className="admin-button admin-primary" type="submit" disabled={mutation.busy}>{mutation.busy ? 'Сохраняем…' : 'Сохранить'}</button>
      <button className="admin-button" type="button" disabled={mutation.busy} onClick={onCancel}>Отмена</button>
    </div>
  </form>;
}

export function AdminCollection<T>({ resource, title, addLabel, load, getId, rows, summary, fields, payload }: {
  resource: string;
  title: string;
  addLabel: string;
  load: (signal: AbortSignal) => Promise<T[]>;
  getId: (row: T) => string | number;
  rows?: (items: T[]) => T[];
  summary: (row: T, items: T[]) => ReactNode;
  fields: (row: T | undefined, items: T[]) => ReactNode;
  payload: (form: FormData, row?: T) => object;
}) {
  const [selected, setSelected] = useState<string | number | 'new'>();
  const { data, loading, error, retry } = useApiQuery(load, true, true);
  const [saved, setSaved] = useState(false);
  const items = data ?? [];
  const row = items.find((item) => getId(item) === selected);

  return <>
    <header className="admin-page-heading">
      <div><h1>{title}</h1>{data && <p className="admin-muted">Всего записей: {items.length}</p>}</div>
      <button type="button" className="admin-button admin-primary" disabled={!data}
        onClick={() => { setSelected('new'); setSaved(false); }}><Plus size={16} />{addLabel}</button>
    </header>
    {saved && <p className="admin-success" role="status">Изменения сохранены</p>}
    <AdminLoad loading={loading && !data} error={error} retry={retry} />
    {data && <div className="admin-collection">
      <div className="admin-panel admin-list">
        {items.length === 0 && <p className="admin-empty">Пока нет записей</p>}
        {(rows?.(items) ?? items).map((item) => <button key={getId(item)} type="button"
          aria-pressed={getId(item) === selected} onClick={() => { setSelected(getId(item)); setSaved(false); }}>
          {summary(item, items)}
        </button>)}
      </div>
      <section className="admin-panel admin-edit-panel">
        {row || selected === 'new' ? <>
          <h2>{row ? 'Редактирование' : addLabel}</h2>
          <AdminEditor key={selected} resource={resource} row={row} getId={getId} fields={fields(row, items)}
            payload={payload} onCancel={() => setSelected(undefined)} onSaved={(updated) => {
              setSelected(getId(updated));
              setSaved(true);
              retry();
            }} />
        </> : <p className="admin-empty">Выберите запись для редактирования.</p>}
      </section>
    </div>}
  </>;
}

export function TextArea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label>{label}<textarea {...props} /></label>;
}

