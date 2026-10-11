import { SupportCenter } from '@/components/support/SupportCenter';
import { Surface } from '@/ui/surfaces';

/** Parent → platform admin. Reached from the profile's support card. */
export default function ParentSupport() {
  return <Surface id="screen.parent.support" screen><SupportCenter title="مركز الحلول" /></Surface>;
}
