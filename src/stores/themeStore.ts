import { create } from 'zustand';
import type { Href } from 'expo-router';
import { applyScheme, currentScheme, isRevisionTheme, setRevisionTheme, type Scheme } from '@/theme/index';

/**
 * The person's appearance choice (founder 2026-10-03: «make also dark mode — not black,
 * dark blue with neon»). Three positions: follow the phone, always light, always dark.
 *
 * Applying a scheme rewrites the live theme tokens (src/theme/index.ts) and bumps
 * `scheme`; the root layout keys the navigation tree on it, so every mounted screen is
 * rebuilt on the new palette. Because that rebuild can reset navigation to the role's home,
 * the screen that flipped the switch leaves a `returnTo` — the root resolve route honours it
 * for a few seconds, then it is just stale and ignored.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'theme_preference';
const RETURN_WINDOW_MS = 4000;

function storage(): { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> } | null {
  try {
    // Lazy require so this leaf module never pulls AsyncStorage into pure consumers.
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

export type SystemScheme = Scheme | null | undefined;

/**
 * Tell iOS / Android which style the APP is in, so native pieces (keyboard, date picker,
 * an unstyled text field) match it. A pinned light or dark choice pins it; «follow the
 * phone» releases it. The app follows the phone's dark mode since 2026-10-04 (the config
 * used to force light, so iOS always answered «light»).
 */
function pinNative(preference: ThemePreference, scheme: Scheme): void {
  try {
    const { Appearance } = require('react-native');
    Appearance?.setColorScheme?.(preference === 'system' ? null : scheme);
  } catch {
    // Not available (tests): the tokens still carry the scheme.
  }
}

export function resolveScheme(preference: ThemePreference, system: SystemScheme): Scheme {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}

function isPreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

/**
 * The season switch's curtain: `to` is the mode being entered, `key` makes each crossing its
 * own mount. The tokens flip CURTAIN_IN_MS after it rises, under cover, and the curtain
 * component drops itself once the rebuilt tree has painted (curtainDone).
 */
export interface RevisionCurtain { to: boolean; key: number }
export const CURTAIN_IN_MS = 240;

interface ThemeState {
  preference: ThemePreference;
  /** The scheme the live tokens currently carry. */
  scheme: Scheme;
  /** Bumped when the backend repaints tokens (setThemeOverrides); the root re-keys on it too. */
  paintEpoch: number;
  repainted: () => void;
  hydrated: boolean;
  returnTo: { href: Href; at: number } | null;
  /** «وضع المراجعة» is painted over the scheme (src/theme/revision.ts). */
  revision: boolean;
  curtain: RevisionCurtain | null;
  /**
   * Lay the season over the scheme, or lift it. Idempotent. `animate` raises the curtain first
   * (a switch the person just flipped); without it the tokens flip at once (the saved value
   * restored at launch, a sign-out). `returnTo` = the screen that flipped it, honoured by the
   * root resolve route after the tree is rebuilt — a pending `rememberReturn` is used when none
   * is given. Returns whether anything changed.
   */
  setRevision: (on: boolean, opts?: { animate?: boolean; returnTo?: Href }) => boolean;
  /** The screen about to flip the season (before the server has answered). */
  rememberReturn: (href: Href | null) => void;
  curtainDone: () => void;
  /**
   * «وضع المراجعة مفعّل الآن» — the welcome sheet after the season was switched ON by hand
   * (founder 2026-10-17: «a popup that revision mode is active now, and what it is»). Raised
   * when the entering curtain falls; never at launch, never on the way out.
   */
  welcome: boolean;
  dismissWelcome: () => void;
  /** Read the saved choice and apply it against the phone's scheme. Safe to call twice. */
  hydrate: (system: SystemScheme) => Promise<void>;
  /** Change the choice, apply it, persist it. `returnTo` = where the switch was flipped. */
  setPreference: (preference: ThemePreference, system: SystemScheme, returnTo?: Href) => Promise<void>;
  /** The phone's scheme changed while the app runs (sunset, a Control-Centre toggle). */
  systemChanged: (system: SystemScheme) => void;
  /** The route to land on after a scheme change, if one was left in the last few seconds. */
  peekReturnTo: () => Href | null;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const apply = (preference: ThemePreference, system: SystemScheme) => {
    const next = resolveScheme(preference, system);
    applyScheme(next);
    pinNative(preference, next);
    if (next !== get().scheme) set({ scheme: next });
  };

  let pendingReturn: Href | null = null;
  let curtainSeq = 0;
  let curtainTimer: ReturnType<typeof setTimeout> | null = null;
  const land = (on: boolean, returnTo: Href | null) => {
    setRevisionTheme(on);
    set({ revision: on, paintEpoch: get().paintEpoch + 1, returnTo: returnTo ? { href: returnTo, at: Date.now() } : null });
  };

  return {
    preference: 'system',
    scheme: currentScheme(),
    paintEpoch: 0,
    hydrated: false,
    returnTo: null,
    revision: isRevisionTheme(),
    curtain: null,
    welcome: false,
    repainted: () => set({ paintEpoch: get().paintEpoch + 1 }),

    setRevision: (on, opts) => {
      if (on === get().revision && !curtainTimer) return false;
      const returnTo = opts?.returnTo ?? pendingReturn;
      pendingReturn = null;
      if (curtainTimer) { clearTimeout(curtainTimer); curtainTimer = null; }
      if (!opts?.animate) {
        if (on === get().revision) return false;
        land(on, returnTo);
        return true;
      }
      curtainSeq += 1;
      set({ curtain: { to: on, key: curtainSeq }, ...(on ? null : { welcome: false }) });
      curtainTimer = setTimeout(() => { curtainTimer = null; land(on, returnTo); }, CURTAIN_IN_MS);
      return true;
    },

    rememberReturn: (href) => { pendingReturn = href; },

    curtainDone: () => {
      if (curtainTimer) return;
      const entered = get().curtain?.to === true && get().revision;
      set({ curtain: null, ...(entered ? { welcome: true } : null) });
    },

    dismissWelcome: () => set({ welcome: false }),

    hydrate: async (system) => {
      let preference: ThemePreference = 'system';
      try {
        const raw = await storage()?.getItem(KEY);
        if (isPreference(raw)) preference = raw;
      } catch {
        // Unreadable storage: follow the phone.
      }
      set({ preference, hydrated: true });
      apply(preference, system);
    },

    setPreference: async (preference, system, returnTo) => {
      set({ preference, returnTo: returnTo ? { href: returnTo, at: Date.now() } : null });
      apply(preference, system);
      try {
        await storage()?.setItem(KEY, preference);
      } catch {
        // Not persisted; the choice still holds for this run.
      }
    },

    systemChanged: (system) => {
      if (get().preference === 'system') apply('system', system);
    },

    peekReturnTo: () => {
      const r = get().returnTo;
      return r && Date.now() - r.at < RETURN_WINDOW_MS ? r.href : null;
    },
  };
});
