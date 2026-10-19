export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  full_name: string;
}

export interface AuthResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  health_score: number;
  financial_persona: string;
  created_at: string;
}
