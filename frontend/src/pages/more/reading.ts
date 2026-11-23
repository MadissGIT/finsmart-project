import { useState } from 'react';
import { isArticleId } from '@/entities/article/api';

const storageKey = 'finsmart:knowledge:saved:v1';

function readSaved(): string[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(data)
      ? data.filter((value): value is string => typeof value === 'string' && isArticleId(value))
      : [];
  } catch {
    return [];
  }
}

export function useSavedArticles() {
  const [saved, setSaved] = useState(readSaved);
  function toggle(id: string) {
    const updated = saved.includes(id) ? saved.filter((value) => value !== id) : [...saved, id];
    setSaved(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Избранное остаётся доступным на открытом экране, если браузер отключил хранилище.
    }
  }
  return { saved, toggle };
}

export function normalizeSearch(text: string): string {
  return text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();
}
