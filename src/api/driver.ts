import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import client from './client';
import { STAGING_KEY, STAGING_HEADER } from '@/config/env';

/**
 * The driver mode of the app: a print shop's rider, signed in by phone + the code the shop
 * gave them. Not a platform user — a separate token, a separate client, and nothing from the
 * teacher / student / parent session is touched.
 */
export const DRIVER_TOKEN_KEY = 'print_driver_token';
let cachedToken: string | null | undefined;

export async function readDriverToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try { cachedToken = await SecureStore.getItemAsync(DRIVER_TOKEN_KEY); } catch { cachedToken = null; }
  return cachedToken;
}

export async function writeDriverToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await SecureStore.setItemAsync(DRIVER_TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(DRIVER_TOKEN_KEY);
  } catch { /* the in-memory copy still serves this run */ }
}

export const driverClient = axios.create({ timeout: 15000 });
driverClient.interceptors.request.use(async (config) => {
  config.baseURL = client.defaults.baseURL;
  config.headers.Accept = 'application/json';
  const token = await readDriverToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (STAGING_KEY) config.headers[STAGING_HEADER] = STAGING_KEY;
  return config;
});

export type DeliveryStatus = 'assigned' | 'picked_up' | 'en_route' | 'arrived' | 'delivered' | 'failed';

export interface DriverProfile {
  id: number; name: string; phone: string; vehicle: string; vehicle_label: string;
  lat: number | null; lng: number | null; seen_at: string | null; online: boolean;
  shop: { id: number; name: string | null; phone: string | null };
  /** Google Maps key from the server (null = the OpenStreetMap fallback). */
  maps_key?: string | null;
}

export interface DriverDelivery {
  id: number;
  status: DeliveryStatus;
  label: string;
  tone: 'info' | 'warning' | 'success' | 'danger' | 'gray';
  is_active: boolean;
  job: { id: number; title: string; copies: number; pages: number; spec_label: string; teacher: string | null; teacher_phone: string | null; payout: number; payment_status: string };
  shop: { name: string | null; address: string | null; lat: number | null; lng: number | null };
  dest: { lat: number | null; lng: number | null; name: string | null; address: string | null };
  /** Where the teacher's phone is right now (shared during the trip), else null. */
  teacher_live?: { lat: number; lng: number; seen_at: string } | null;
  remaining_km: number | null;
  eta_min: number | null;
  assigned_at: string | null; picked_up_at: string | null; en_route_at: string | null; arrived_at: string | null; delivered_at: string | null;
  fail_reason: string | null;
}

const unwrap = <T,>(data: any): T => (data?.data ?? data) as T;

export async function driverLogin(phone: string, code: string): Promise<{ token: string; driver: DriverProfile }> {
  const { data } = await driverClient.post('/driver/login', { phone, code });
  return unwrap(data);
}

/** The QR scan: the one-time token from the shop's QR → a driver session. */
export async function driverJoin(token: string): Promise<{ token: string; driver: DriverProfile }> {
  const { data } = await driverClient.post('/driver/join', { token });
  return unwrap(data);
}

export async function driverMe(): Promise<DriverProfile> {
  const { data } = await driverClient.get('/driver/me');
  return unwrap(data);
}

export async function driverLogout(): Promise<void> {
  try { await driverClient.post('/driver/logout'); } catch { /* the token is dropped locally either way */ }
}

/** «I'm here and free» — the shop's map shows available drivers. */
export async function driverHeartbeat(lat: number, lng: number): Promise<void> {
  await driverClient.post('/driver/heartbeat', { lat, lng });
}

export async function getDriverDeliveries(): Promise<DriverDelivery[]> {
  const { data } = await driverClient.get('/driver/deliveries');
  return unwrap<{ deliveries: DriverDelivery[] }>(data).deliveries;
}

export async function getDriverDelivery(id: number | string): Promise<DriverDelivery> {
  const { data } = await driverClient.get(`/driver/deliveries/${id}`);
  return unwrap(data);
}

export async function deliveryStep(id: number, step: 'pickup' | 'enroute' | 'arrived'): Promise<DriverDelivery> {
  const { data } = await driverClient.post(`/driver/deliveries/${id}/${step}`);
  return unwrap(data);
}

export async function deliveryPing(id: number, lat: number, lng: number, speed?: number | null): Promise<{ status: DeliveryStatus; label: string; remaining_km: number | null; eta_min: number | null }> {
  const { data } = await driverClient.post(`/driver/deliveries/${id}/ping`, { lat, lng, speed: speed ?? undefined });
  return unwrap(data);
}

export async function deliveryDeliver(id: number, code: string): Promise<DriverDelivery> {
  const { data } = await driverClient.post(`/driver/deliveries/${id}/deliver`, { code });
  return unwrap(data);
}

export async function deliveryFail(id: number, reason: string): Promise<DriverDelivery> {
  const { data } = await driverClient.post(`/driver/deliveries/${id}/fail`, { reason });
  return unwrap(data);
}

/** The driver's walk, for the tracker. */
export const DELIVERY_FLOW: DeliveryStatus[] = ['assigned', 'picked_up', 'en_route', 'arrived', 'delivered'];
