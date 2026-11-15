import { describe, expect, it } from 'vitest';
import { MAX_STATEMENT_BYTES, validateStatement } from './api';

describe('выбор выписки', () => {
  it('совпадает с лимитом backend 5 МБ включительно', () => {
    expect(validateStatement({ name: 'bank.CSV', size: MAX_STATEMENT_BYTES })).toBeNull();
    expect(validateStatement({ name: 'bank.xlsx', size: MAX_STATEMENT_BYTES + 1 })).toContain('5 МБ');
  });
  it('не отправляет пустые файлы и неподдерживаемые расширения', () => {
    expect(validateStatement({ name: 'bank.csv', size: 0 })).toContain('пуст');
    expect(validateStatement({ name: 'bank.csv.exe', size: 10 })).toContain('CSV');
  });
});
