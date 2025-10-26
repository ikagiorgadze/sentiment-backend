// Authentication interfaces

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUserResponse;
  token: string;
}

export interface AuthSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export interface UserPostAccess {
  id: string;
  auth_user_id: string;
  post_id: string;
  granted_at: Date;
  granted_by: string | null;
}

