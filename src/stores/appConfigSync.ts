import i18n from '@/i18n';
import { getAppConfig } from '@/api/appConfig';
import { useAppConfigStore } from '@/stores/appConfigStore';

/** Apply the curated copy overlay onto i18n (dotted keys handled by addResource). */
function applyCopyOverlay(copy: Record<string, string>): void {
  for (const [key, value] of Object.entries(copy ?? {})) {
    try {
      i18n.addResource('ar', 'translation', key, value);
    } catch {
      // A malformed key must never break the overlay for the rest.
    }
  }
}

/**
 * Fetch /app-config and apply it. Silent no-op on failure (keeps last-good).
 * Call on cold start and on every app foreground.
 */
export async function syncAppConfig(): Promise<void> {
  try {
    const cfg = await getAppConfig();
    useAppConfigStore.getState().setConfig(cfg);
    applyCopyOverlay(cfg.copy ?? {});
  } catch {
    // Bad network / server down / expired token — a no-op, never surfaced.
  }
}
