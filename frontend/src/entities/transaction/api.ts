import { api } from '@/shared/api/client';
import { ApiContractError, isRecord } from '@/shared/lib/guards';
import type { BankHint } from './model/types';

export const MAX_STATEMENT_BYTES = 5 * 1024 * 1024;
export interface ImportResult {
  total_parsed: number;
  imported_count: number;
  duplicates_skipped: number;
  skipped_rows: number;
}

export function validateStatement(file: Pick<File, 'name' | 'size'>): string | null {
  if (!/\.(csv|xlsx)$/i.test(file.name)) return 'Выберите файл CSV или XLSX.';
  if (file.size === 0) return 'Выбранный файл пуст.';
  if (file.size > MAX_STATEMENT_BYTES) return 'Размер файла должен быть не больше 5 МБ.';
  return null;
}

export async function importStatement(file: File, bank: BankHint): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('bank_hint', bank);
  const { data } = await api.post<unknown>('/transactions/import-statement', form);
  if (!isRecord(data) || !['total_parsed', 'imported_count', 'duplicates_skipped', 'skipped_rows'].every((key) => typeof data[key] === 'number' && Number.isSafeInteger(data[key]) && Number(data[key]) >= 0)) throw new ApiContractError();
  return { total_parsed: Number(data.total_parsed), imported_count: Number(data.imported_count), duplicates_skipped: Number(data.duplicates_skipped), skipped_rows: Number(data.skipped_rows) };
}
