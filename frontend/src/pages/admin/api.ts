import type { Article } from '@/entities/article/model/types';
import type { Discount } from '@/entities/discount/model/types';
import type { UserRole } from '@/entities/user/model/types';
import { api } from '@/shared/api/client';

type Status = 'draft' | 'published' | 'hidden';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  blocked_at: string | null;
  created_at: string;
  operations: number;
  imports: number;
  goals: number;
  last_activity: string | null;
}
export interface AdminCategory {
  id: number;
  name: string;
  parent_id: number | null;
  budget_group: string;
  keywords: string[];
}
export interface AdminDiscount extends Discount {
  status: Status;
  valid_from: string | null;
}
export interface AdminArticle extends Article { status: Status }
export interface AdminBadge {
  code: string;
  title: string;
  level: string;
  icon: string;
  condition: string;
  points: number;
  metric: string | null;
  target: number;
  enabled: boolean;
}
export interface AdminAnalytics {
  imports: number;
  recognition_percent: number | null;
  profiles: number;
  active_accounts: number;
  popular_goals: Record<string, number>;
}
export interface AdminTicket {
  id: string;
  email: string;
  message: string;
  status: 'open' | 'answered' | 'closed';
  reply: string | null;
  answered_at: string | null;
  created_at: string;
  attachment_name: string | null;
}

export const pageSize = 30;

async function get<T>(endpoint: string, signal: AbortSignal, params?: Record<string, string | number>) {
  const { data } = await api.get<T>('/admin/' + endpoint, { signal, params });
  return data;
}
export const getCategories = (signal: AbortSignal) => get<AdminCategory[]>('categories', signal);
export const getDiscounts = (signal: AbortSignal) => get<AdminDiscount[]>('discounts', signal);
export const getArticles = (signal: AbortSignal) => get<AdminArticle[]>('articles', signal);
export const getBadges = (signal: AbortSignal) => get<AdminBadge[]>('badges', signal);
export const getAnalytics = (signal: AbortSignal) => get<AdminAnalytics>('analytics', signal);
export const getUsers = (signal: AbortSignal, q: string, page: number) =>
  get<AdminUser[]>('users', signal, { q, limit: pageSize, offset: page * pageSize });
export const getTickets = (signal: AbortSignal, page: number) =>
  get<AdminTicket[]>('tickets', signal, { limit: pageSize, offset: page * pageSize });

export async function saveAdminRow<T>(resource: string, id: string | number | undefined, payload: object) {
  const path = '/admin/' + resource;
  const response = id === undefined ? await api.post<T>(path, payload)
    : await api.put<T>(path + '/' + encodeURIComponent(id), payload);
  return response.data;
}
export async function blockUser(id: string, blocked: boolean) {
  await api.put('/admin/users/' + id + '/block', { blocked });
}
export async function downloadAttachment(id: string, name: string) {
  const { data } = await api.get<Blob>('/admin/tickets/' + id + '/attachment', { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
