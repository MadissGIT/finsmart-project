export type BudgetGroup = 'NEEDS' | 'WANTS' | 'SAVINGS' | 'INCOME' | 'OTHER';

export interface Category {
  id: number;
  name: string;
  budget_group: BudgetGroup;
}
