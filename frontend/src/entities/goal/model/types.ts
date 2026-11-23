export interface CreateGoalRequest {
  title: string;
  target_amount: number;
  deadline: string;
  icon: string;
}

export interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  icon: string;
  monthly_payment_recommended: number;
  weekly_payment_recommended: number;
  progress_percent: number;
  months_left: number;
  exceeds_half_income: boolean;
  warning: string | null;
}

export type DepositSource = 'free_money' | 'discount';

export interface GoalDepositRequest {
  amount: number;
  source: DepositSource;
}

export interface GoalDepositResponse {
  goal_id: string;
  current_amount: number;
  progress_percent: number;
  acceleration_days: number;
  message: string;
}

export interface Contribution {
  id: string;
  amount: number;
  source: DepositSource;
  created_at: string;
}
