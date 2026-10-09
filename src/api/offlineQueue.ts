import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n';
import { formatNumber } from '@/utils/format';

/**
 * Which actions may wait on the phone when there is no connection (founder 2026-10-09:
 * «more offline friendly on the majority of actions»). A queued action is stored by
 * src/db/outbox.ts and replayed by src/db/autoSync.ts when the connection returns, with the
 * same X-Idempotency-Key it was first sent with, so the server runs it once even if the first
 * try did reach it and only the answer was lost.
 *
 * Teacher and assistant only (src/api/client.ts): theirs is the app that sends the queue.
 *
 * Not here on purpose: signing in and codes (an answer is the point), uploads (a photo is
 * too big to park), money going BACK (reversals, waivers — live, with the person present),
 * removing or terminating anyone, cash drawer closes, and the door scan + manual marks, which
 * have their own queues with window matching.
 */
export interface QueueRule {
  method: 'post' | 'put' | 'patch' | 'any';
  path: RegExp;
  /** Key under offline.actions in ar.json — the line shown on the sync screen. */
  label: string;
}

const N = '\\d+';

export const QUEUE_RULES: QueueRule[] = [
  { method: 'post', path: new RegExp(`^/teacher/(pending-collections/collect|students/${N}/collect)$`), label: 'collect' },
  { method: 'post', path: /^\/teacher\/pending-collections\/cancel-due$/, label: 'cancel_due' },
  { method: 'post', path: new RegExp(`^/teacher/sessions/${N}/(note|sheet-grade|sheet-toggle|sheet-excluded|sheet-max-mark|type)$`), label: 'session_sheet' },
  { method: 'post', path: new RegExp(`^/teacher/sessions/${N}/cancel$`), label: 'session_cancel' },
  { method: 'post', path: new RegExp(`^/teacher/sessions/${N}/restore$`), label: 'session_restore' },
  { method: 'post', path: /^\/teacher\/sessions$/, label: 'session_create' },
  { method: 'post', path: new RegExp(`^/teacher/(excuses|session-swaps|student-edit-requests)/${N}/(approve|reject)$`), label: 'decision' },
  { method: 'post', path: new RegExp(`^/teacher/assistant-reports/[a-z_-]+/${N}/(approve|reject)$`), label: 'decision' },
  { method: 'post', path: new RegExp(`^/teacher/assistant-actions/${N}/reject$`), label: 'decision' },
  { method: 'post', path: new RegExp(`^/teacher/booking-requests/${N}/(accept|reject)$`), label: 'decision' },
  { method: 'post', path: new RegExp(`^/teacher/payment-proofs/${N}/(approve|reject)$`), label: 'decision' },
  { method: 'post', path: new RegExp(`^/teacher/complaints/${N}/(approve|reject|review)$`), label: 'decision' },
  { method: 'post', path: new RegExp(`^/teacher/expenses/${N}/review$`), label: 'decision' },
  { method: 'patch', path: new RegExp(`^/notifications/${N}/(read|unread)$`), label: 'notification' },
  { method: 'post', path: new RegExp(`^/notifications/(${N}/(dismiss|restore)|read-all)$`), label: 'notification' },
  { method: 'post', path: new RegExp(`^/(tickets|tickets/${N}/messages|teacher/admin-tickets|support/tickets|teacher/expenses/${N}/thread)$`), label: 'message' },
  { method: 'post', path: /^\/teacher\/expenses$/, label: 'expense' },
  { method: 'post', path: new RegExp(`^/teacher/students/${N}/(report|parent-unreachable|flag-parent-number|edit-request)$`), label: 'student_note' },
  { method: 'post', path: new RegExp(`^/(billing-overrides|teacher/allowance-setting|teacher/students/${N}/allowance-block)$`), label: 'allowance' },
  { method: 'post', path: /^\/teacher\/students\/record(\/order-cards)?$/, label: 'record_student' },
  { method: 'post', path: /^\/invitations(\/link)?$/, label: 'invite' },
  { method: 'post', path: new RegExp(`^/teacher/enrollments/${N}/(prior-months|prior-billing-months|settled-before-joining|cycle-position|cycle-amount|backfill-attendance|billing-year/(add|cancel))$`), label: 'enrollment' },
  { method: 'post', path: /^\/teacher\/(courses|schedules)$/, label: 'course' },
  { method: 'patch', path: new RegExp(`^/teacher/courses/${N}(/schedules/${N})?$`), label: 'course' },
  { method: 'post', path: new RegExp(`^/teacher/locations(/${N}/(toggle|assistants))?$`), label: 'venue' },
  { method: 'put', path: new RegExp(`^/teacher/locations/${N}$`), label: 'venue' },
  { method: 'post', path: new RegExp(`^/revisions/${N}/instances/${N}/mark$`), label: 'revision_mark' },
];

/** The rule that lets this request wait offline, or null when it must be live. */
export function matchQueueRule(method: string | undefined, url: string | undefined): QueueRule | null {
  if (!method || !url) return null;
  const m = method.toLowerCase();
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '').split('?')[0];
  for (const r of QUEUE_RULES) if ((r.method === 'any' || r.method === m) && r.path.test(path)) return r;
  return null;
}

/** The request body as stored and replayed — axios may have serialised it already. */
export function bodyString(data: unknown): string | null {
  if (data == null) return null;
  return typeof data === 'string' ? data : JSON.stringify(data);
}

/** «تحصيل · 300 ج.م» — the line on the sync screen. */
export function queuedLabel(rule: QueueRule, body: string | null): string {
  let text = i18n.t(`offline.actions.${rule.label}`);
  try {
    const parsed = body ? (JSON.parse(body) as { amount?: unknown }) : null;
    const amount = Number(parsed?.amount);
    if (Number.isFinite(amount) && amount > 0) text += ` · ${formatNumber(amount)} ج.م`;
  } catch {
    // not JSON — the label alone
  }
  return text;
}

export interface Queued { queued: true; offline: true; message: string }

/**
 * What the caller receives instead of the server's answer. Both shapes the API modules read
 * (`data.data ?? data`, and JSON:API `data.data.attributes`) say the same thing, and
 * `isQueued()` tells a screen apart from a real result.
 */
export function syntheticQueuedResponse(config: InternalAxiosRequestConfig): AxiosResponse {
  const message = i18n.t('offline.queued');
  const flag: Queued = { queued: true, offline: true, message };
  const data = { ...flag, success: true, data: { ...flag, type: 'queued', id: 'queued', attributes: { ...flag } } };
  return { data, status: 202, statusText: 'Queued', headers: { 'x-offline-queued': '1' }, config };
}

export function isQueued(x: unknown): x is Queued {
  return !!x && typeof x === 'object' && (x as { queued?: unknown }).queued === true;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set by the request interceptor when the request may wait offline. */
    __queueRule?: QueueRule;
    /** A replay from the outbox: never re-queued, its idempotency key reused. */
    __replay?: boolean;
  }
}
