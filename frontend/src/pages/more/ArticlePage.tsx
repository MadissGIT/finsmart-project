import { Fragment, useCallback, useState } from 'react';
import { ArrowLeft, Bookmark, Clock, Share } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getArticle, isArticleId } from '@/entities/article/api';
import type { Article } from '@/entities/article/model/types';
import { MoreError, MoreHeading } from './MoreUi';
import { useSavedArticles } from './reading';
import { useApiQuery } from '@/shared/api/useApiQuery';

function ArticleText({ text }: { text: string }) {
  return text.trim().split(/\r?\n\s*\r?\n/).filter(Boolean).map((block, index) => {
    const [firstLine, ...lines] = block.split(/\r?\n/);
    const heading = firstLine.match(/^(?:#{1,4} |\d+\. )(.+)$/)?.[1];
    if (!heading || lines.length === 0) return <p key={index}>{block}</p>;
    return (
      <Fragment key={index}>
        <h2>{heading}</h2>
        <p>{lines.join('\n')}</p>
      </Fragment>
    );
  });
}

export function ArticlePage() {
  const { articleId = '' } = useParams();
  const { search } = useLocation();
  const load = useCallback((signal: AbortSignal) => getArticle(articleId, signal), [articleId]);
  const valid = isArticleId(articleId);
  const result = useApiQuery(load, valid);
  const back = '/more/knowledge' + search;

  if (!valid || result.notFound) {
    return (
      <div className="more-page">
        <MoreHeading title="Статья не найдена" back={back} />
        <div className="more-state"><Link className="button-primary" to={back}>К базе знаний</Link></div>
      </div>
    );
  }

  if (!result.data) {
    return (
      <div className="more-page">
        <MoreHeading title="Статья" back={back} />
        {result.error
          ? <MoreError error={result.error} retry={result.retry} />
          : <p role="status" className="more-state">Загружаем статью…</p>}
      </div>
    );
  }

  return <ArticleContent key={articleId} article={result.data} back={back} />;
}

function ArticleContent({ article, back }: { article: Article; back: string }) {
  const { saved, toggle } = useSavedArticles();
  const [notice, setNotice] = useState('');
  const isSaved = saved.includes(article.id);

  async function share() {
    const url = new URL('/more/knowledge/' + article.id, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: article.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice('Ссылка на статью скопирована.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNotice('Скопируйте ссылку из адресной строки браузера.');
    }
  }

  return (
    <article className="more-page knowledge-article">
      <div className="knowledge-article-actions">
        <Link to={back} className="icon-button" aria-label="К базе знаний"><ArrowLeft size={22} aria-hidden="true" /></Link>
        <button type="button" className="icon-button" onClick={() => void share()} aria-label="Поделиться статьёй"><Share size={21} aria-hidden="true" /></button>
      </div>
      {notice && <p role="status" className="more-state">{notice}</p>}
      <div className="knowledge-cover">
        <img src="/illustrations/wallet.webp" alt="" width="180" height="135" />
      </div>
      <h1>{article.title}</h1>
      <p className="knowledge-duration"><Clock size={16} aria-hidden="true" />{article.read_time_min} мин чтения</p>
      <div className="knowledge-body">
        <ArticleText text={article.content_markdown} />
        {!!article.action_checklist.length && (
          <section aria-labelledby="knowledge-checklist">
            <h2 id="knowledge-checklist">Что можно сделать</h2>
            <ol className="knowledge-checklist">
              {article.action_checklist.map((step, index) => <li key={index}>{step}</li>)}
            </ol>
          </section>
        )}
      </div>
      <button type="button" className="button-primary knowledge-save" aria-label="Избранное" aria-pressed={isSaved} onClick={() => toggle(article.id)}>
        <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
        {isSaved ? 'Убрать из избранного' : 'Сохранить в избранное'}
      </button>
    </article>
  );
}
