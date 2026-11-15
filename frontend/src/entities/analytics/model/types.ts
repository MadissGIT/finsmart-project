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

export interface DiagnosticAlert {
  // В черновом контракте приведён только WARNING_OVERSPEND; список ещё открыт.
  type: string;
  category: string;
  message: string;
  potential_saving: number;
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

export interface DiagnosticsSummary {
  health_score: number;
  persona: string;
  alerts: DiagnosticAlert[];
}
