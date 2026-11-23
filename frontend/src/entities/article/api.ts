import { api } from '@/shared/api/client';
import { ApiContractError, isRecord } from '@/shared/lib/guards';
import type { Article } from './model/types';

export function isArticleId(value: string): boolean {
  return /^[a-z0-9-]{1,80}$/i.test(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isArticle(value: unknown): value is Article {
  return isRecord(value)
    && typeof value.id === 'string' && isArticleId(value.id)
    && typeof value.title === 'string' && value.title.trim().length > 0
    && typeof value.category === 'string'
    && typeof value.read_time_min === 'number' && Number.isInteger(value.read_time_min) && value.read_time_min > 0
    && typeof value.summary === 'string'
    && typeof value.content_markdown === 'string'
    && strings(value.action_checklist)
    && strings(value.tags);
}

export async function listArticles(tag: string, signal: AbortSignal): Promise<Article[]> {
  const { data } = await api.get<unknown>('/articles', {
    params: tag ? { limit: 100, tags: tag } : { limit: 100 },
    signal,
  });
  if (!Array.isArray(data) || !data.every(isArticle)) throw new ApiContractError();
  return data;
}

export async function getArticle(id: string, signal: AbortSignal): Promise<Article> {
  const { data } = await api.get<unknown>('/articles/' + encodeURIComponent(id), { signal });
  if (!isArticle(data) || data.id !== id) throw new ApiContractError();
  return data;
}
