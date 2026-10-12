import { useAppConfigStore } from '@/stores/appConfigStore';
import type { AbilityDef } from '@/config/defaults';

/**
 * The assistant abilities as the SERVER names them (`abilities` in /app-config), so a key
 * this build never saw still has a label — in the assistants screen, a notice, a popup.
 * Empty until the first config arrives; callers fall back to the key itself.
 */
export function useAbilityCatalog(): AbilityDef[] {
  return useAppConfigStore((s) => s.config.abilities ?? []);
}

export function abilityLabel(key: string, catalog: AbilityDef[]): string {
  return catalog.find((a) => a.key === key)?.label ?? key;
}
