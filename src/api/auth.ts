import client from './client';
import { extractAttrs } from './utils';
import type { AuthResponse, RegisterResponse } from '@/types/user';

export async function login(phone_number: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/login', { phone_number, password });
  return extractAttrs(data.data ?? data);
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/refresh', { refresh_token: refreshToken });
  return extractAttrs(data.data ?? data);
}

export async function register(payload: {
  name: string;
  phone_number: string;
  parent_phone: string;
  parent_relation: string;
  parent_name: string;
  terms_accepted: boolean;
}): Promise<RegisterResponse> {
  const { data } = await client.post('/auth/register', payload);
  return data;
}

/**
 * Request account deletion (Apple 5.1.1(v)). Server marks the account and blocks
 * future login/refresh; the client then clears the local session.
 */
export async function deleteAccount(): Promise<void> {
  await client.post('/account/delete');
}

export async function verifyOtp(phone: string, code: string, purpose = 'registration') {
  const { data } = await client.post('/auth/verify-otp', { phone, code, purpose });
  return data;
}

/** Resend the registration OTP to a pending parent phone (rate-limited server-side). */
export async function resendOtp(phone: string): Promise<void> {
  await client.post('/auth/resend-otp', { phone });
}

/** Correct the parent phone of a pending registration; sends a fresh OTP to the new number. */
export async function changeRegistrationPhone(current_phone: string, new_phone: string): Promise<string> {
  const { data } = await client.post('/auth/change-registration-phone', { current_phone, new_phone });
  return (data?.data?.parent_phone as string) ?? new_phone;
}

/** Forgot password — step 1: request a reset code by SMS. Always succeeds (no enumeration). */
export async function forgotPassword(phone_number: string): Promise<void> {
  await client.post('/auth/forgot-password', { phone_number });
}

/** Forgot password — step 2: verify the code + set a new password → logged-in session. */
export async function resetPassword(phone_number: string, code: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post('/auth/reset-password', { phone_number, code, password });
  return extractAttrs(data.data ?? data);
}

/** Change password while logged in (verifies the current password server-side). */
export async function changePassword(current_password: string, password: string): Promise<void> {
  await client.post('/auth/change-password', { current_password, password });
}

export type ParentRelationship = 'father' | 'mother' | 'guardian';

export interface ParentSetupInfo {
  name: string;
  phone_number: string;
  relationship?: ParentRelationship | null;
  already_set: boolean;
}

/** First-time parent setup: details (phone read-only; name + relation editable). */
export async function getParentSetup(token: string): Promise<ParentSetupInfo> {
  const { data } = await client.get(`/parent-setup/${token}`);
  return extractAttrs(data.data ?? data);
}

export interface ParentSetupPayload {
  password: string;
  terms_accepted: boolean;
  /** Optional — the parent may set/modify their own name + relation at setup. */
  name?: string;
  relationship?: ParentRelationship;
}

/** Set the parent's password (+ optional name/relation) via the setup token. */
export async function setParentPassword(token: string, payload: ParentSetupPayload): Promise<AuthResponse> {
  const { data } = await client.post(`/parent-setup/${token}`, payload);
  return extractAttrs(data.data ?? data);
}
