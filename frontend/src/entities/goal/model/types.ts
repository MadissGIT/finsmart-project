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
  monthly_payment_recommended: number;
  progress_percent: number;
  months_left: number;
}

export interface GoalDepositRequest {
  amount: number;
  // Остальные источники в контракте ещё не перечислены.
  source: string;
}

export interface GoalDepositResponse {
  goal_id: string;
  current_amount: number;
  progress_percent: number;
  message: string;
}
