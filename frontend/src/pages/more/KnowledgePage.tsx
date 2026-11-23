import { useCallback } from 'react';
import { ArrowRight, Bookmark, BookOpen, Calculator, ChevronRight, CreditCard, GraduationCap, PiggyBank, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { listArticles } from '@/entities/article/api';
import type { Article } from '@/entities/article/model/types';
import { MoreError, MoreHeading, MoreSearch } from './MoreUi';
import { normalizeSearch, useSavedArticles } from './reading';
import { useApiQuery } from '@/shared/api/useApiQuery';

const icons = {
  'Основы бюджетирования': Calculator,
  'Целеполагание': PiggyBank,
  'Финансовая безопасность': ShieldCheck,
  'Кредиты и займы': CreditCard,
};

function ArticleLink({ article, query }: { article: Article; query: string }) {
  const Icon = icons[article.category as keyof typeof icons] ?? BookOpen;
  return (
    <Link className="more-menu-item knowledge-item" to={'/more/knowledge/' + article.id + query}>
      <span className="more-menu-icon"><Icon size={25} aria-hidden="true" /></span>
      <span className="more-menu-copy">
        <strong>{article.title}</strong>
        <span>{article.read_time_min} мин · <span className="knowledge-read">Читать</span></span>
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </Link>
  );
}

function loadCatalog(signal: AbortSignal) {
  return listArticles('', signal);
}

export function KnowledgePage() {
  const [params, setParams] = useSearchParams();
  const tag = (params.get('tag') ?? '').slice(0, 120);
  const search = (params.get('q') ?? '').slice(0, 120);
  const savedOnly = params.get('saved') === '1';
  const query = normalizeSearch(search);
  const { saved } = useSavedArticles();
  const loadByTag = useCallback((signal: AbortSignal) => listArticles(tag, signal), [tag]);
  const catalog = useApiQuery(loadCatalog);
  const tagged = useApiQuery(loadByTag, !!tag);
  const current = tag ? tagged : catalog;
  const tags = [...new Set((catalog.data ?? []).flatMap((article) => article.tags))];
  if (tag && !tags.includes(tag)) tags.push(tag);

  const articles = (current.data ?? []).filter((article) => (
    (!savedOnly || saved.includes(article.id))
    && (!query || [article.title, article.category, article.summary, ...article.tags].some((text) => normalizeSearch(text).includes(query)))
  ));
  const showHero = !tag && !query && !savedOnly;
  const featured = showHero ? catalog.data?.[0] : undefined;
  const locationSearch = params.size ? '?' + params.toString() : '';

  function updateFilter(key: string, value: string, replace = false) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace });
  }

  return (
    <div className="more-page knowledge-page">
      <MoreHeading title="База знаний" back="/more" />
      <div className="knowledge-tools">
        <MoreSearch label="Поиск статей" value={search} onChange={(value) => updateFilter('q', value, true)} />
        <button
          className="knowledge-bookmarks"
          type="button"
          aria-label="Избранные статьи"
          aria-pressed={savedOnly}
          onClick={() => updateFilter('saved', savedOnly ? '' : '1')}
        >
          <Bookmark size={18} fill={savedOnly ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <div className="knowledge-tags" role="group" aria-label="Темы статей">
        <button type="button" aria-pressed={!tag} onClick={() => updateFilter('tag', '')}>Все</button>
        {tags.map((topic) => (
          <button key={topic} type="button" aria-pressed={topic === tag} onClick={() => updateFilter('tag', topic)}>
            {topic}
          </button>
        ))}
      </div>
      {tag && catalog.error && (
        <div className="more-state">
          <p role="alert">Не удалось загрузить список тем.</p>
          <button className="inline-link" type="button" onClick={catalog.retry}>Повторить</button>
        </div>
      )}
      {featured && (
        <section className="knowledge-hero">
          <GraduationCap className="knowledge-cap" size={90} strokeWidth={1.65} aria-hidden="true" />
          <h2>Финансовая грамотность — просто о сложном</h2>
          <p>Полезные статьи и советы</p>
          <Link to={'/more/knowledge/' + featured.id} aria-label={'Читать ' + featured.title}>
            <ArrowRight size={24} aria-hidden="true" />
          </Link>
        </section>
      )}
      <section className="knowledge-list" aria-labelledby="knowledge-list-title">
        <h2 id="knowledge-list-title">{savedOnly ? 'Избранное' : 'Полезные статьи'}</h2>
        {current.loading && <p role="status" className="more-state">Загружаем статьи…</p>}
        {current.error && <MoreError error={current.error} retry={current.retry} />}
        {current.data && (articles.length > 0
          ? <ul>{articles.map((article) => <li key={article.id}><ArticleLink article={article} query={locationSearch} /></li>)}</ul>
          : <div className="more-state">
            <p>{savedOnly && !tag && !query ? 'Здесь появятся сохранённые статьи.' : 'Подходящих статей пока нет.'}</p>
            {(tag || query) && (
              <button type="button" className="button-secondary" onClick={() => setParams(savedOnly ? { saved: '1' } : {})}>
                Сбросить фильтры
              </button>
            )}
          </div>)}
      </section>
    </div>
  );
}
