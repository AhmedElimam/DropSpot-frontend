export interface User {
  id: number;
  user_type_id: number;
  name: string;
  email: string;
  phone: string | null;
  email_verified_at: string | null;
  created_at: string;
  student_id?: number | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  device_token?: string;
  platform?: 'ios' | 'android' | 'web';
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface LoginResponse {
  data: {
    id: string;
    type: 'authenticated-user';
    attributes: {
      user: User;
      tokens: AuthTokens;
    };
  };
}
