import { financialToday } from '@/shared/lib/calendar';
import { useApiQuery } from '@/shared/api/useApiQuery';
import { AdminCollection, AdminLoad, TextArea } from './AdminUi';
import { getArticles, getBadges, getCategories, getDiscounts } from './api';
import type { AdminCategory, AdminDiscount } from './api';
import { lines, text } from './format';

const budgetGroups: Record<string, string> = {
  NEEDS: 'Обязательные', WANTS: 'Желания', SAVINGS: 'Сбережения', INCOME: 'Доходы', OTHER: 'Прочее',
};
const statuses = { draft: 'Черновик', published: 'Опубликовано', hidden: 'Скрыто' };
const badgeMetrics = {
  first_import: 'Первый импорт выписки',
  first_goal: 'Первая копилка',
  first_deposit: 'Первое пополнение копилки',
  goal_reached: 'Достижение цели копилки',
  recent_entries: 'Ручные операции за 7 дней',
  expenses: 'Ручные расходы за всё время',
  deposits: 'Пополнения копилок',
  weekly_challenges: 'Завершённые недельные челленджи',
  challenges: 'Все завершённые челленджи',
};

function StatusField({ value = 'draft' }: { value?: keyof typeof statuses }) {
  return <label>Статус
    <select name="status" defaultValue={value}>
      {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label>;
}

function categoryTree(items: AdminCategory[]) {
  const sorted: AdminCategory[] = [];
  function add(parentId: number | null) {
    for (const item of items.filter(({ parent_id }) => parent_id === parentId)) {
      sorted.push(item);
      add(item.id);
    }
  }
  add(null);
  return sorted;
}

function categoryDepth(row: AdminCategory, all: AdminCategory[]) {
  let depth = 0;
  let parentId = row.parent_id;
  while (parentId !== null) {
    depth++;
    parentId = all.find((item) => item.id === parentId)?.parent_id ?? null;
  }
  return depth;
}

export function CategoriesPage() {
  return <AdminCollection resource="categories" title="Категории" addLabel="Добавить категорию"
    load={getCategories} getId={(row) => row.id} rows={categoryTree}
    summary={(row, all) => <span style={{ paddingInlineStart: Math.min(categoryDepth(row, all), 5) * 12 }}>
      <strong>{row.name}</strong><small>{budgetGroups[row.budget_group]} · Ключевые слова: {row.keywords.length}</small>
    </span>}
    fields={(row, all) => <>
      <label>Название<input name="name" required maxLength={100} defaultValue={row?.name} /></label>
      <label>Родительская категория
        <select name="parent_id" defaultValue={row?.parent_id ?? ''}>
          <option value="">Корневой уровень</option>
          {categoryTree(all).filter((item) => item.id !== row?.id).map((item) =>
            <option key={item.id} value={item.id}>{'— '.repeat(categoryDepth(item, all))}{item.name}</option>)}
        </select>
      </label>
      <label>Группа бюджета
        <select name="budget_group" defaultValue={row?.budget_group ?? 'OTHER'}>
          {Object.entries(budgetGroups).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <TextArea name="keywords" label="Ключевые слова" rows={6} defaultValue={row?.keywords.join('\n')}
        placeholder="Одно слово или выражение на строку" />
    </>}
    payload={(form) => ({
      name: text(form, 'name'), parent_id: Number(text(form, 'parent_id')) || null,
      budget_group: text(form, 'budget_group'), keywords: lines(text(form, 'keywords')),
    })} />;
}

function offerStatus(row: AdminDiscount) {
  if (row.status !== 'published') return statuses[row.status];
  const today = financialToday();
  if (row.valid_until < today) return 'Срок истёк';
  if (row.valid_from && row.valid_from > today) return 'Запланировано';
  return 'На витрине';
}

export function DiscountsPage() {
  const categories = useApiQuery(getCategories);
  if (!categories.data) return <AdminLoad {...categories} />;
  const items = categoryTree(categories.data);

  return <AdminCollection resource="discounts" title="Скидки и купоны" addLabel="Добавить предложение"
    load={getDiscounts} getId={(row) => row.id}
    summary={(row) => <><span><strong>{row.partner_name}</strong><small>{row.title}</small></span>
      <span className="admin-tag">{offerStatus(row)}</span></>}
    fields={(row) => <>
      <div className="admin-form-row">
        <label>Магазин<input name="partner_name" required maxLength={200} defaultValue={row?.partner_name} /></label>
        <label>Категория
          <select name="category_id" required defaultValue={row?.category_id ?? ''}>
            <option value="">Выбрать категорию</option>
            {items.map((item) => <option key={item.id} value={item.id}>{'— '.repeat(categoryDepth(item, items))}{item.name}</option>)}
          </select>
        </label>
      </div>
      <label>Название предложения<input name="title" required maxLength={500} defaultValue={row?.title} /></label>
      <div className="admin-form-row">
        <label>Промокод<input name="promocode" maxLength={100} defaultValue={row?.promocode ?? ''} /></label>
        <label>Скидка, %<input name="discount_percent" type="number" min="0" max="100" defaultValue={row?.discount_percent ?? 0} /></label>
      </div>
      <div className="admin-form-row">
        <label>Старая цена, ₽<input name="original_price" type="number" min="0.01" step="0.01" defaultValue={row?.original_price ?? ''} /></label>
        <label>Новая цена, ₽<input name="sale_price" type="number" min="0" step="0.01" defaultValue={row?.sale_price ?? ''} /></label>
      </div>
      <label>Выгода на карточке<input name="benefit" maxLength={200} defaultValue={row?.benefit} placeholder="Например, 300 ₽" /></label>
      <label>Ссылка на магазин<input name="affiliate_url" maxLength={2000} type="url" defaultValue={row?.affiliate_url} /></label>
      <div className="admin-form-row">
        <label>Начало акции<input name="valid_from" type="date" defaultValue={row?.valid_from ?? ''} /></label>
        <label>Последний день акции<input name="valid_until" type="date" required defaultValue={row?.valid_until} /></label>
      </div>
      <TextArea name="activation" label="Как получить скидку" rows={2} maxLength={4000} defaultValue={row?.activation} />
      <TextArea name="conditions" label="Условия акции" rows={3} maxLength={4000} defaultValue={row?.conditions} />
      <StatusField value={row?.status} />
      <label className="admin-checkbox"><input type="checkbox" name="is_demo" defaultChecked={row?.is_demo} />Демонстрационное предложение</label>
    </>}
    payload={(form) => ({
      partner_name: text(form, 'partner_name'), title: text(form, 'title'), category_id: Number(text(form, 'category_id')),
      promocode: text(form, 'promocode') || null, discount_percent: Number(text(form, 'discount_percent')),
      original_price: text(form, 'original_price') || null, sale_price: text(form, 'sale_price') || null,
      benefit: text(form, 'benefit'), affiliate_url: text(form, 'affiliate_url'),
      valid_from: text(form, 'valid_from') || null, valid_until: text(form, 'valid_until'),
      activation: text(form, 'activation'), conditions: text(form, 'conditions'),
      status: text(form, 'status'), is_demo: form.has('is_demo'),
    })} />;
}

export function ArticlesPage() {
  return <AdminCollection resource="articles" title="База знаний" addLabel="Новая статья"
    load={getArticles} getId={(row) => row.id}
    summary={(row) => <><span><strong>{row.title}</strong><small>{row.category}</small></span>
      <span className="admin-tag">{statuses[row.status]}</span></>}
    fields={(row) => <>
      <label>Заголовок<input name="title" required maxLength={200} defaultValue={row?.title} /></label>
      <div className="admin-form-row">
        <label>Рубрика<input name="category" required maxLength={100} defaultValue={row?.category} /></label>
        <label>Время чтения, мин<input name="read_time_min" required type="number" min="1" max="180" defaultValue={row?.read_time_min ?? 3} /></label>
      </div>
      <TextArea label="Краткое описание" name="summary" required rows={3} maxLength={1000} defaultValue={row?.summary} />
      <TextArea label="Текст статьи" name="content_markdown" required rows={10} maxLength={60000} defaultValue={row?.content_markdown} />
      <TextArea label="Теги" name="tags" rows={3} placeholder="Один тег на строку" defaultValue={row?.tags.join('\n')} />
      <TextArea label="Чек-лист" name="action_checklist" rows={3} placeholder="Один пункт на строку" defaultValue={row?.action_checklist.join('\n')} />
      <StatusField value={row?.status} />
    </>}
    payload={(form) => ({
      title: text(form, 'title'), category: text(form, 'category'),
      read_time_min: Number(text(form, 'read_time_min')), summary: text(form, 'summary'),
      content_markdown: text(form, 'content_markdown'), tags: lines(text(form, 'tags')),
      action_checklist: lines(text(form, 'action_checklist')), status: text(form, 'status'),
    })} />;
}

export function BadgesPage() {
  return <AdminCollection resource="badges" title="Достижения" addLabel="Добавить бейдж"
    load={getBadges} getId={(row) => row.code}
    summary={(row) => <><span><strong>{row.icon} {row.title}</strong><small>{row.condition}</small></span>
      <span className="admin-tag">{row.enabled ? 'Начисляется' : 'Отключён'}</span></>}
    fields={(row) => <>
      {!row && <label>Код бейджа<input name="code" required maxLength={40} pattern="[A-Z][A-Z0-9_]*" placeholder="FIRST_EXPENSE" /></label>}
      <label>Название<input name="title" required maxLength={100} defaultValue={row?.title} /></label>
      <div className="admin-form-row">
        <label>Уровень<select name="level" defaultValue={row?.level ?? 'Бронза'}>
          {['Бронза', 'Серебро', 'Золото', 'Платина'].map((level) => <option key={level}>{level}</option>)}
        </select></label>
        <label>Символ<input name="icon" required maxLength={20} defaultValue={row?.icon ?? '🏅'} /></label>
        <label>Баллы<input name="points" type="number" required min="0" max="1000" defaultValue={row?.points ?? 10} /></label>
      </div>
      <label>Событие или показатель<select name="metric" defaultValue={row?.metric ?? ''}>
        <option value="">Выбрать показатель</option>
        {Object.entries(badgeMetrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Порог<input name="target" type="number" required min="1" max="10000" defaultValue={row?.target ?? 1} /></label>
      <p className="admin-muted">Для разового события укажите порог 1. Начисленные баллы сохраняются после редактирования.</p>
      <TextArea label="Условие для пользователя" name="condition" required maxLength={500} rows={3} defaultValue={row?.condition} />
      <label className="admin-checkbox"><input name="enabled" type="checkbox" defaultChecked={row?.enabled} />Начислять автоматически</label>
    </>}
    payload={(form, row) => ({
      ...(!row ? { code: text(form, 'code') } : {}),
      title: text(form, 'title'), level: text(form, 'level'), icon: text(form, 'icon'),
      points: Number(text(form, 'points')), metric: text(form, 'metric') || null,
      target: Number(text(form, 'target')), condition: text(form, 'condition'), enabled: form.has('enabled'),
    })} />;
}
