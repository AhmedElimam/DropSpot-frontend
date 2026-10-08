import { useTranslation } from 'react-i18next';
import { useRoseStore } from '@/stores/roseStore';
import { useActiveAbilities } from '@/hooks/useActiveAbilities';

/**
 * How the accounts persona is named on THIS person's screens (founder 2026-10-02): a
 * teacher may switch her name off — her screens then say «المساعدة الشخصية» — while an
 * assistant always sees «مدام روز» and has no control over it. Strings that mention her
 * take `{{rose}}` and pass `name`; the screen title has its own two forms.
 */
export function useRose(): { named: boolean; name: string; title: string } {
  const { t } = useTranslation();
  const { isAssistant } = useActiveAbilities();
  const teacherNamed = useRoseStore((s) => s.named);
  const named = isAssistant || teacherNamed;

  return {
    named,
    name: t(named ? 'cash.persona_name' : 'cash.persona_generic'),
    title: t(named ? 'cash.title' : 'cash.screen_title'),
  };
}
