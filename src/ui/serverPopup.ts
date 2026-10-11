import { Linking } from 'react-native';
import { router } from 'expo-router';
import { Alert, useDialogStore } from '@/ui/dialog';
import { useAppConfigStore } from '@/stores/appConfigStore';
import type { UiPopup, UiPopupButton } from '@/config/defaults';
import i18n from '@/i18n';

/**
 * Popups and navigations the BACKEND asks for (App\Support\MobileUi): any JSON answer may
 * carry `meta.popup` (a spec, or `{id}` naming one in the manifest) and `meta.navigate`.
 * The API client hands them here (src/api/client.ts). Buttons carry an action:
 * dismiss · navigate:<path> · url:<https link> · popup:<id>. Anything malformed is ignored —
 * a bad manifest must never break a screen.
 */
export function runPopupAction(action: string | undefined, button?: Pick<UiPopupButton, 'body' | 'confirm'>): void {
  if (!action || action === 'dismiss') return;
  if (action.startsWith('navigate:/')) { try { router.push(action.slice('navigate:'.length) as never); } catch { /* unknown route */ } return; }
  if (action.startsWith('url:https://')) { void Linking.openURL(action.slice('url:'.length)).catch(() => {}); return; }
  if (action.startsWith('popup:')) { showServerPopup(action.slice('popup:'.length)); return; }
  if (action.startsWith('api:')) { void runApiAction(action, button); }
}

const API_ACTION = /^api:(get|post|put|patch|delete) (\/[^\s]+)$/;

/**
 * `api:<method> </path>` — a button the BACKEND drew calls a backend endpoint (with the bearer
 * token, through the same client as every screen). `confirm` is asked first; `body` is sent
 * flat. The answer's meta (popup / navigate) is shown by the client as always; with no popup
 * its `message` is, and every mounted query refetches, so the screen reflects what changed.
 * A failure shows the server's words. This is what makes a new feature a backend-only change.
 */
export async function runApiAction(action: string, button?: Pick<UiPopupButton, 'body' | 'confirm'>): Promise<boolean> {
  const m = API_ACTION.exec(action);
  if (!m) return false;
  if (button?.confirm) {
    const ok = await new Promise<boolean>((resolve) => Alert.alert(button.confirm!, undefined, [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: i18n.t('common.confirm'), onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
    if (!ok) return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = (require('@/api/client') as typeof import('@/api/client')).default;
    const res = await client.request({ method: m[1], url: m[2], data: button?.body && Object.keys(button.body).length ? button.body : undefined });
    const data = res?.data as { message?: unknown; meta?: { popup?: unknown } } | undefined;
    if (!data?.meta?.popup && typeof data?.message === 'string' && data.message.trim()) Alert.alert(data.message);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    void (require('@/lib/queryClientRef') as typeof import('@/lib/queryClientRef')).getQueryClient()?.invalidateQueries();
    return true;
  } catch (e) {
    const meta = (e as { response?: { data?: { meta?: unknown } } })?.response?.data?.meta;
    if (!(meta as { popup?: unknown } | undefined)?.popup) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Alert.alert(i18n.t('common.error'), (require('@/utils/errors') as typeof import('@/utils/errors')).getFriendlyErrorMessage(e));
    }
    return false;
  }
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
  Alert.alert(spec.title, spec.body ?? undefined, spec.buttons.map((b) => ({ text: b.label, style: b.style, onPress: () => runPopupAction(b.action, b) })));
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
