import i18n from '@/i18n';
import ar from '@/i18n/ar.json';

/**
 * Rewordings from backend code (server `config/mobile_ui.php` → `ui.texts`, founder 2026-10-29:
 * «everything editable from the backend only, no OTA»): a map of the app's own i18n keys to new
 * Arabic. Applied over the bundled strings whenever the config lands (launch, foreground, the
 * cached copy); removing a line on the server brings the bundled wording back, because the
 * bundle is re-laid first every time. Keys with a dot are nested the way ar.json is.
 */
// i18next merges INTO the object it is handed, so the bundle must be re-laid from a copy each time.
const BUNDLED = JSON.stringify(ar);

export function applyServerTexts(texts: Record<string, string> | undefined): void {
  const overrides: Record<string, unknown> = {};
  let n = 0;
  for (const [key, value] of Object.entries(texts ?? {})) {
    if (typeof value !== 'string' || value === '') continue;
    const parts = key.split('.').filter(Boolean);
    if (parts.length < 2) continue;
    let node = overrides;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (typeof next !== 'object' || next === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
    n++;
  }
  // The bundle first (so a dropped override reverts), then what the server says, deep-merged.
  i18n.addResourceBundle('ar', 'translation', JSON.parse(BUNDLED), true, true);
  if (n > 0) i18n.addResourceBundle('ar', 'translation', overrides, true, true);
}
