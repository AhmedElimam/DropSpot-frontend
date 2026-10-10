/**
 * Firebase Analytics, kept small and private (founder 2026-10-10: «integrate firebase
 * analytics on the mobile app»). Many of our users are students — minors — so:
 *
 *   · no advertising ID on either platform (iOS: FirebaseAnalytics WithoutAdIdSupport;
 *     Android: no AdID / SSAID — firebase.json), no ad personalisation, no ad storage;
 *   · never a name, a phone, a student or user id, or a typed search term — only what
 *     kind of thing happened (a role, a screen, a feature, a kind of payment, a count);
 *   · nothing while a super-admin is impersonating (their taps are not the teacher's);
 *   · the app-instance id is reset on sign-out, so the next person on a shared phone
 *     starts a new, unlinked history.
 *
 * Every call is fire-and-forget and swallows its own failure: analytics must never break,
 * slow or block a screen. In Jest (and anywhere the native module is missing) it is a no-op.
 */
type Params = Record<string, string | number | boolean | undefined>;

interface AnalyticsApi {
  getAnalytics: (app?: unknown) => unknown;
  logEvent: (a: unknown, name: string, params?: Record<string, unknown>) => Promise<void>;
  logScreenView: (a: unknown, params: { screen_name: string; screen_class: string }) => Promise<void>;
  setUserProperty: (a: unknown, name: string, value: string | null) => Promise<void>;
  setAnalyticsCollectionEnabled: (a: unknown, enabled: boolean) => Promise<void>;
  resetAnalyticsData: (a: unknown) => Promise<void>;
}

let api: AnalyticsApi | null | undefined;
let instance: unknown = null;
let enabled = true;

function load(): AnalyticsApi | null {
  if (api !== undefined) return api;
  if (process.env.JEST_WORKER_ID) return (api = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics') as AnalyticsApi;
    instance = mod.getAnalytics();
    api = mod;
  } catch {
    api = null; // no native module in this build — stay silent
  }
  return api;
}

function clean(params?: Params): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    // GA4 limits: 40-char names, 100-char string values.
    out[k.slice(0, 40)] = typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'string' ? v.slice(0, 100) : v;
  }
  return out;
}

/** A thing that happened. Names are snake_case, params never personal (see above). */
export function track(name: string, params?: Params): void {
  const a = load();
  if (!a || !enabled) return;
  a.logEvent(instance, name, clean(params)).catch(() => {});
}

/** The screen on show — a route pattern, never an id («/sessions/[id]», not «/sessions/812»). */
export function trackScreen(route: string): void {
  const a = load();
  if (!a || !enabled) return;
  a.logScreenView(instance, { screen_name: route.slice(0, 100), screen_class: route.split('/').filter(Boolean)[0] ?? 'root' }).catch(() => {});
}

/** Who is using the app, as a kind of person only: teacher / assistant / parent / student / admin. */
export function setAnalyticsRole(role: string | null): void {
  const a = load();
  if (!a) return;
  a.setUserProperty(instance, 'role', role).catch(() => {});
}

/** Off while impersonating; back on after. */
export function setAnalyticsEnabled(on: boolean): void {
  const a = load();
  enabled = on;
  if (!a) return;
  a.setAnalyticsCollectionEnabled(instance, on).catch(() => {});
}

/** Sign-out: forget this phone's analytics history so the next person starts unlinked. */
export function resetAnalytics(): void {
  const a = load();
  if (!a) return;
  a.setUserProperty(instance, 'role', null).catch(() => {});
  a.resetAnalyticsData(instance).catch(() => {});
}

/** «/sessions/812/attendance» → «/sessions/[id]/attendance»: ids and tokens never leave the phone. */
export function routePattern(pathname: string): string {
  return pathname
    .split('?')[0]
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) || seg.length > 32 ? '[id]' : seg))
    .join('/') || '/';
}
