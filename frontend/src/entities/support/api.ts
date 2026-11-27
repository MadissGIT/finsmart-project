import { api } from '@/shared/api/client';
import { ApiContractError, isRecord, isUuid } from '@/shared/lib/guards';

export const supportAttachmentTypes = ['application/pdf', 'image/png', 'image/jpeg'];
export const maxSupportAttachmentBytes = 2 * 1024 * 1024;

export async function sendSupportTicket(message: string, requestId: string, attachment: File | null) {
  const form = new FormData();
  form.append('request_id', requestId);
  form.append('message', message);
  if (attachment) form.append('attachment', attachment);
  const { data } = await api.post<unknown>('/support/tickets', form);
  if (!isRecord(data) || !isUuid(data.id) || data.status !== 'open') throw new ApiContractError();
  return data.id;
}

export interface PersonalSupportTicket {
  id: string;
  message: string;
  status: 'open' | 'answered' | 'closed';
  reply: string | null;
  created_at: string;
}

export async function getSupportTickets(signal: AbortSignal) {
  const { data } = await api.get<PersonalSupportTicket[]>('/support/tickets', { signal });
  return data;
}
