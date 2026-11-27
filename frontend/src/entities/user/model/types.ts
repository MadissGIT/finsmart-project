export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  full_name: string;
  welcome?: boolean;
  birth_date?: string;
  goal?: string | null;
  income_range?: string | null;
}

export interface AuthResponse {
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export type UserRole = 'user' | 'admin' | 'moderator';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  birth_date?: string | null;
  goal: string | null;
  income_range: string | null;
  preferences_saved: boolean;
  role: UserRole;
}
