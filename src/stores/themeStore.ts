import { create } from 'zustand';
import type { Href } from 'expo-router';
import { applyScheme, currentScheme, type Scheme } from '@/theme/index';

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

export function resolveScheme(preference: ThemePreference, system: SystemScheme): Scheme {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}

function isPreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

interface ThemeState {
  preference: ThemePreference;
  /** The scheme the live tokens currently carry. */
  scheme: Scheme;
  hydrated: boolean;
  returnTo: { href: Href; at: number } | null;
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
    if (next !== get().scheme) set({ scheme: next });
  };

  return {
    preference: 'system',
    scheme: currentScheme(),
    hydrated: false,
    returnTo: null,

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
