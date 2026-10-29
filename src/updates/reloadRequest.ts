import type { ReloadRequest } from '@/config/defaults';
import { prepareReload, runningUpdate } from '@/updates/otaUpdates';

/**
 * «اطلب من الكل إعادة فتح التطبيق» on the phone (backend App\Support\AppReload, founder
 * 2026-10-29). Ops ask, after an OTA release, for every phone to restart into it. A phone answers
 * each request once: it fetches the newest bundle and, when there is one to apply (or ops asked
 * regardless), shows the soft lock — one calm screen, one restart button. A phone with nothing
 * to apply notes the request as done and shows nothing.
 */
const DONE_KEY = 'reload_request_done';

function storage(): { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

export async function doneRequestId(): Promise<string | null> {
  try { return (await storage()?.getItem(DONE_KEY)) ?? null; } catch { return null; }
}

export async function markRequestDone(id: string): Promise<void> {
  try { await storage()?.setItem(DONE_KEY, id); } catch { /* the worst case is one more ask */ }
}

/** Is this request for this phone at all? (Not answered yet, and for its runtime when one is named.) */
export function appliesHere(req: ReloadRequest | null | undefined, doneId: string | null, runtime: string | null): req is ReloadRequest {
  if (!req) return false;
  if (doneId === req.id) return false;
  if (req.runtime && runtime && req.runtime !== runtime) return false;
  return true;
}

/**
 * Decide for one request: 'lock' (show the screen), 'done' (nothing to apply — noted), or
 * 'later' (updates off here, or the check failed — ask again on the next foreground).
 */
export async function answerReloadRequest(req: ReloadRequest | null | undefined): Promise<'lock' | 'done' | 'later'> {
  const runtime = runningUpdate().runtime;
  if (!appliesHere(req, await doneRequestId(), runtime)) return 'later';
  const state = await prepareReload();
  if (state === 'off') return 'later';
  if (state === 'pending' || req.force) return 'lock';
  if (state === 'error') return 'later';
  await markRequestDone(req.id);
  return 'done';
}
