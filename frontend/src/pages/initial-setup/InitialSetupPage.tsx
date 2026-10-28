import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Check, FileUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '@/widgets/app-layout/Header';

export function InitialSetupPage() {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName('');
    if (!/\.(csv|xlsx)$/i.test(file.name)) { setError('Выберите файл CSV или XLSX.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Размер файла должен быть не больше 10 МБ.'); return; }
    setError('');
    setFileName(file.name);
  }

  return (
    <div className="initial-setup-page">
      <Header />
      <h1 className="onboarding-title">Давайте настроим<br />Ваш профиль</h1>
      <p className="onboarding-description">Чтобы получить персональные рекомендации и аналитику, нам нужно немного данных о Ваших расходах</p>
      <img className="setup-illustration" src="/illustrations/statement.png" width="230" height="173" alt="Банковская выписка в форматах CSV и XLSX" />
      <div className="onboarding-info statement-info"><FileUp size={25} aria-hidden="true" /><div><h2>Загрузите банковскую выписку</h2><ul>{['Автоматическая категоризация', 'Полная картина расходов', 'Персональные рекомендации'].map((text) => <li key={text}><Check size={12} aria-hidden="true" />{text}</li>)}</ul></div></div>
      <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Выбрать банковскую выписку" onChange={selectFile} />
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {fileName ? <p className="file-notice" role="status">Выбран файл: <strong>{fileName}</strong>. В демоверсии файл не отправляется. Импорт появится после подключения соответствующего API.</p> : null}
      <div className="setup-actions"><button className="button-primary" type="button" onClick={() => input.current?.click()}>Загрузить выписку</button><Link className="button-secondary" to="/">Перейти к обзору</Link><Link className="text-link" to="/">Позже</Link></div>
    </div>
  );
}
