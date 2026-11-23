export interface DashboardSummary {
  total_income: number;
  total_expense: number;
  net_balance: number;
}

export interface BudgetAllocation {
  amount: number;
  percent: number;
  target_percent: number;
  target_amount: number;
  deviation: number;
}

export interface CategoryExpense {
  category_id: number;
  name: string;
  amount: number;
  percent: number;
}

export interface DashboardResponse {
  period: { from: string; to: string };
  summary: DashboardSummary;
  budget_50_30_20: {
    needs: BudgetAllocation;
    wants: BudgetAllocation;
    savings: BudgetAllocation;
  };
  by_categories: CategoryExpense[];
  income_base: number;
  deficit_financing: boolean;
  unallocated_expense: number;
  budget_score: number;
}

export interface DiagnosticOffer {
  id: string;
  partner_name: string;
  title: string;
  benefit: string;
  is_demo: boolean;
  valid_until: string;
}

export interface DiagnosticAlert {
  type: string;
  category: string;
  title: string;
  message: string;
  recommendation: string;
  potential_saving: number;
  badge: string | null;
  discounts: DiagnosticOffer[];
}

export interface FinancialDiagnosis {
  health_score: number;
  status: string;
  color: string;
  indices: { balance: number; budget: number; goals: number; regularity: number };
  alerts: DiagnosticAlert[];
  unavailable: Record<string, string>;
}

export interface DiagnosisResponse {
  period: DashboardResponse['period'];
  summary: DashboardSummary;
  diagnostics: FinancialDiagnosis;
}

export type ExpenseGrouping = 'day' | 'week';

export interface ExpensePoint {
  date: string;
  amount: number;
}
