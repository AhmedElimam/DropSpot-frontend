import { Linking } from 'react-native';
import { router } from 'expo-router';
import { Alert, useDialogStore } from '@/ui/dialog';
import { useAppConfigStore } from '@/stores/appConfigStore';
import type { UiPopup } from '@/config/defaults';

/**
 * Popups and navigations the BACKEND asks for (App\Support\MobileUi): any JSON answer may
 * carry `meta.popup` (a spec, or `{id}` naming one in the manifest) and `meta.navigate`.
 * The API client hands them here (src/api/client.ts). Buttons carry an action:
 * dismiss · navigate:<path> · url:<https link> · popup:<id>. Anything malformed is ignored —
 * a bad manifest must never break a screen.
 */
export function runPopupAction(action: string | undefined): void {
  if (!action || action === 'dismiss') return;
  if (action.startsWith('navigate:/')) { try { router.push(action.slice('navigate:'.length) as never); } catch { /* unknown route */ } return; }
  if (action.startsWith('url:https://')) { void Linking.openURL(action.slice('url:'.length)).catch(() => {}); return; }
  if (action.startsWith('popup:')) { showServerPopup(action.slice('popup:'.length)); }
}

/** Resolve `{id}` or a spec against the manifest; null when there is nothing sound to show. */
export function resolvePopup(input: unknown): UiPopup | null {
  const byId = (id: string) => useAppConfigStore.getState().config.ui?.popups?.[id] ?? null;
  const spec = typeof input === 'string' ? byId(input) : (input && typeof input === 'object' && 'id' in (input as object) && !('title' in (input as object)))
    ? byId(String((input as { id: unknown }).id))
    : (input as UiPopup | null);
  if (!spec || typeof spec !== 'object' || typeof spec.title !== 'string' || !spec.title.trim()) return null;
  const buttons = Array.isArray(spec.buttons) ? spec.buttons.filter((b) => b && typeof b.label === 'string' && b.label.trim()).slice(0, 3) : [];
  return { title: spec.title, body: typeof spec.body === 'string' ? spec.body : null, buttons: buttons.length ? buttons : [{ label: 'حسنًا', action: 'dismiss' }], persona: spec.persona === 'rose' ? 'rose' : undefined };
}

export function showServerPopup(input: unknown): boolean {
  const spec = resolvePopup(input);
  if (!spec) return false;
  const store = useDialogStore.getState();
  const before = store.persona;
  if (spec.persona === 'rose') store.setPersona('rose');
  Alert.alert(spec.title, spec.body ?? undefined, spec.buttons.map((b) => ({ text: b.label, style: b.style, onPress: () => runPopupAction(b.action) })));
  if (spec.persona === 'rose') store.setPersona(before);
  return true;
}

/** What the API client calls with a response body's `meta`, on success and on failure alike. */
export function handleServerMeta(meta: unknown): void {
  if (!meta || typeof meta !== 'object') return;
  const m = meta as { popup?: unknown; navigate?: unknown };
  if (m.popup) showServerPopup(m.popup);
  if (typeof m.navigate === 'string' && m.navigate.startsWith('/')) { try { router.push(m.navigate as never); } catch { /* unknown route */ } }
}
