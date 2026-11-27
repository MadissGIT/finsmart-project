import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '@/shared/ui/Brand';
import { MoreHeading, MoreSearch } from './MoreUi';
import { normalizeSearch } from './reading';

const questions = [
  {
    id: 'add-expense',
    question: 'Как добавить расход?',
    answer: 'Откройте «Транзакции», нажмите «+», выберите «Расход» и заполните сумму, категорию, дату и организацию.',
    to: '/transactions',
    label: 'Открыть транзакции',
  },
  {
    id: 'balance',
    question: 'Почему не обновляется баланс?',
    answer: 'На «Обзоре» видны доходы и расходы за выбранный период. Проверьте даты и убедитесь, что операция сохранена. Нажмите кнопку обновления рядом с заголовком обзора.',
    to: '/',
    label: 'Открыть обзор',
  },
  {
    id: 'import',
    question: 'Как загрузить банковскую выписку?',
    answer: 'Скачайте CSV или XLSX со списком операций, выберите банк и подтвердите импорт. Поддерживаются выписки Сбера, Т-Банка и ВТБ до 5 МБ.',
    to: '/setup',
    label: 'Загрузить выписку',
  },
  {
    id: 'analytics',
    question: 'Где посмотреть отчёт по расходам?',
    answer: 'Откройте «Аналитику» и выберите период. Нажмите на сектор диаграммы или на название категории, чтобы увидеть её сумму и долю.',
    to: '/analytics',
    label: 'Открыть аналитику',
  },
  {
    id: 'support',
    question: 'Что делать, если приложение не загружает данные?',
    answer: 'Откройте «Поддержку», опишите ошибку и отправьте обращение.',
    to: '/more/support',
    label: 'Открыть поддержку',
  },
];

export function FaqPage() {
  const [search, setSearch] = useState('');
  const query = normalizeSearch(search);
  const matches = questions.filter(({ question, answer }) => normalizeSearch(question + ' ' + answer).includes(query));

  return (
    <div className="more-page">
      <MoreHeading title="Вопрос-ответ" back="/more" />
      <MoreSearch label="Поиск по вопросам" value={search} onChange={setSearch} />
      <div className="faq-list">
        {matches.map(({ id, question, answer, to, label }, index) => (
          <details className="faq-item" key={id} name="finsmart-faq" open={index === 0}>
            <summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary>
            <div><p>{answer}</p><Link className="inline-link" to={to}>{label}</Link></div>
          </details>
        ))}
        {matches.length === 0 && <p role="status" className="more-state">По этому запросу ничего не найдено.</p>}
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="more-page">
      <MoreHeading title="О приложении" back="/more" />
      <section className="more-info">
        <Brand large />
        <p>«ФинСмарт» помогает вести учёт доходов и расходов, разбирать траты по категориям и планировать бюджет по правилу 50/30/20.</p>
        <Link className="button-primary" to="/more/knowledge">Перейти к статьям</Link>
        <Link className="text-link" to="/more/support">Помощь с приложением</Link>
      </section>
    </div>
  );
}
