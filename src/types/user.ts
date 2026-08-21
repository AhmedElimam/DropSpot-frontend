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
  /** Opaque per-card credential to encode in the digital check-in QR (never the raw code). */
  card_token?: string | null;
  /** Teacher first-login gate: true until they set their own password (change-password stamps it). */
  must_set_password?: boolean;
  /** Student deferred gate: true until they OTP-verify their OWN number (raised by the daily sweep). */
  needs_own_number_verification?: boolean;
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
    /** false = the parent was already verified; the server skipped the OTP and linked. */
    otp_required?: boolean;
    /** Single-use parent setup link (only on the normal, non-skip path). */
    parent_setup_link?: string | null;
    message: string;
  };
}
