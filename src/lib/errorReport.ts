import { Platform } from 'react-native';
import Constants from 'expo-constants';
import client from '@/api/client';
import { runningUpdate } from '@/updates/otaUpdates';

/**
 * JS errors reported to our own backend (founder 2026-10-11: «debugging and fixing bugs
 * on UI … via the back end»): the super-admin reads them at /admin/app-errors with the
 * version, the update, the screen and the stack — enough to publish an OTA fix without
 * asking a teacher to describe what happened.
 *
 * Private by construction: the message, the stack, the ROUTE PATTERN (ids stripped —
 * src/lib/analytics.ts), the role, the app and OS versions. Never a name, a phone, an
 * id, a token or a typed value. Light: at most MAX_PER_SESSION reports a session, one per
 * distinct error, sent fire-and-forget and swallowed on failure; switched off from
 * /app-config (error_reporting = off) when it must be.
 */
const MAX_PER_SESSION = 20;
const STACK_MAX = 6000;
const MESSAGE_MAX = 500;

let installed = false;
let enabled = true;
let role: string | null = null;
let route = '/';
let sent = 0;
const seen = new Set<string>();

export function setErrorReportingEnabled(on: boolean): void { enabled = on; }
export function setErrorReportingRole(r: string | null): void { role = r; }
/** The screen pattern the person is on (AnalyticsTracker keeps it current). */
export function noteRoute(pattern: string): void { route = pattern; }

type ErrorUtilsLike = { getGlobalHandler: () => ((e: Error, isFatal?: boolean) => void) | undefined; setGlobalHandler: (h: (e: Error, isFatal?: boolean) => void) => void };

/** Wrap the global JS error handler once. The previous handler (the red box in dev, the crash in release) still runs. */
export function installErrorReporting(): void {
  if (installed) return;
  installed = true;
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((e, isFatal) => {
    try { void reportError(e, { fatal: !!isFatal }); } catch { /* never throw from here */ }
    previous?.(e, isFatal);
  });
}

/**
 * Report one error. Also for a catch block that swallows something worth knowing:
 * `reportError(e, { where: 'collect.submit' })`. Dedupes by message+route per session.
 */
export async function reportError(e: unknown, ctx: { fatal?: boolean; where?: string } = {}): Promise<void> {
  if (!enabled || sent >= MAX_PER_SESSION) return;
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'non-error thrown');
  const message = String(err.message || err.name || 'error').slice(0, MESSAGE_MAX);
  const key = `${message}|${route}|${ctx.where ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent++;
  const u = runningUpdate();
  const body = {
    platform: Platform.OS,
    os_version: String(Platform.Version ?? ''),
    app_version: Constants.expoConfig?.version ?? '0',
    update_id: u.update_id,
    runtime: u.runtime,
    role,
    route,
    where: ctx.where ?? null,
    fatal: !!ctx.fatal,
    message,
    stack: String(err.stack ?? '').slice(0, STACK_MAX),
  };
  try {
    await client.post('/app-errors', body, { timeout: 8000 });
  } catch {
    // reporting must never fail loudly
  }
}

/** Test seam. */
export function __resetErrorReportingForTests(): void { installed = false; enabled = true; role = null; route = '/'; sent = 0; seen.clear(); }
