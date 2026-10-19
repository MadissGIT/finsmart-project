export type OperationType = 'DEBIT' | 'CREDIT';
export type BankHint = 'tinkoff' | 'sber' | 'vtb' | 'auto';

export interface CreateTransactionRequest {
  amount: number;
  operation_type: OperationType;
  category_id: number;
  transaction_date: string;
  merchant_name: string;
  comment?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  operation_type: OperationType;
  category_id: number;
  category_name: string;
  transaction_date: string;
  merchant_name: string;
}

// Импорт в спецификации возвращает date, ручное создание — transaction_date.
export interface ImportedTransaction {
  id: string;
  date: string;
  amount: number;
  operation_type: OperationType;
  category_id: number;
  category_name: string;
  merchant_name: string;
  confidence: number;
}

export interface ImportStatementResponse {
  total_parsed: number;
  successfully_categorized: number;
  accuracy_rate: number;
  imported_transactions: ImportedTransaction[];
}

export interface UpdateCategoryRequest {
  category_id: number;
  save_as_global_rule: boolean;
}

export interface UpdateCategoryResponse {
  status: 'success';
  message: string;
}
