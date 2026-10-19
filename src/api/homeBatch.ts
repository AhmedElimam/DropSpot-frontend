import client from './client';
import { useAuthStore } from '@/stores/authStore';

/**
 * The teacher home screen's reads in ONE request (founder 2026-10-19: «optimise … without
 * breaking anything»). On open, Home asked for about ten endpoints at once; on shared hosting
 * each paid a phone round trip and a server boot of its own.
 *
 * Nothing about the screens changes. Each API function asks `homePart(part, direct)` for the
 * response body it used to read itself. Calls that arrive together (within WINDOW_MS) go out
 * as GET /teacher/home?parts=…, which runs each real endpoint on the server with this
 * request's own headers and gates and returns its status and body untouched. Then:
 *   · a part that came back 200 resolves with that body (its `meta` popup still runs);
 *   · anything else — a refused or failed part, a server without /teacher/home, a lone call —
 *     takes the old road: `direct()`, the very request the function made before;
 *   · no answer at all (offline, timeout) fails every waiting call with that error, exactly
 *     as their own requests would have — never a second wait for a fallback.
 * Only for a teacher or an assistant: a parent's or a student's calls go straight out.
 */
export type HomePart =
  | 'unread' | 'today' | 'cash' | 'booking_requests' | 'assistant_actions'
  | 'phone_confirmations' | 'tickets' | 'complaints_pending' | 'resolution' | 'revise_mode';

type Waiter = { resolve: (body: any) => void; reject: (e: unknown) => void; direct: () => Promise<any> };

export const WINDOW_MS = 20;
let queue = new Map<HomePart, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
/** The server has no /teacher/home (an older backend): stop asking for this app run. */
let unsupported = false;

export function homePart<T = any>(part: HomePart, direct: () => Promise<T>): Promise<T> {
  const role = useAuthStore.getState().role;
  if (unsupported || (role !== 'teacher' && role !== 'assistant')) return direct();
  return new Promise<T>((resolve, reject) => {
    const list = queue.get(part) ?? [];
    list.push({ resolve, reject, direct });
    queue.set(part, list);
    if (!timer) timer = setTimeout(() => { void flush(); }, WINDOW_MS);
  });
}

function goDirect(w: Waiter) {
  w.direct().then(w.resolve, w.reject);
}

function serverMeta(meta: unknown) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@/ui/serverPopup') as typeof import('@/ui/serverPopup')).handleServerMeta(meta);
  } catch {
    // a steering hint never breaks a response
  }
}

async function flush(): Promise<void> {
  const batch = queue;
  queue = new Map();
  timer = null;
  // One part alone gains nothing from the batch.
  if (batch.size < 2) {
    batch.forEach((ws) => ws.forEach(goDirect));
    return;
  }
  let parts: Record<string, { status?: number; body?: any } | undefined>;
  try {
    const res = await client.get('/teacher/home', { params: { parts: [...batch.keys()].join(',') } });
    parts = res?.data?.data?.parts ?? {};
  } catch (e: any) {
    if (!e?.response) {
      batch.forEach((ws) => ws.forEach((w) => w.reject(e)));
      return;
    }
    if (e.response.status === 404 || e.response.status === 405) unsupported = true;
    batch.forEach((ws) => ws.forEach(goDirect));
    return;
  }
  batch.forEach((ws, part) => {
    const p = parts[part];
    if (p && p.status === 200 && p.body && typeof p.body === 'object') {
      if (p.body.meta) serverMeta(p.body.meta);
      ws.forEach((w) => w.resolve(p.body));
    } else {
      ws.forEach(goDirect);
    }
  });
}

/** Test seam. */
export function __resetHomeBatch(): void {
  queue = new Map();
  if (timer) clearTimeout(timer);
  timer = null;
  unsupported = false;
}
