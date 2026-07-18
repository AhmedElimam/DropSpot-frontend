export interface User {
  id: number;
  user_type_id: number;
  name: string;
  email: string;
  phone: string | null;
  email_verified_at: string | null;
  created_at: string;
  student_id?: number | null;
  student_code?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginPayload {
  phone_number: string;
  password: string;
  device_token?: string;
  platform?: 'ios' | 'android' | 'web';
}

export interface RegisterPayload {
  name: string;
  phone_number: string;
  password: string;
  parent_phone: string;
  parent_relation: string;
  parent_name: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  role?: 'student' | 'parent' | 'teacher' | 'assistant' | null;
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

export interface RegisterResponse {
  data: {
    student_id: number;
    parent_phone: string;
    message: string;
  };
}
