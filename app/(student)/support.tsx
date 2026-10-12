import { SupportCenter } from '@/components/support/SupportCenter';
import { Surface } from '@/ui/surfaces';

/** Student → platform admin. Reached from the profile's support card. */
export default function StudentSupport() {
  return <Surface id="screen.student.support" screen><SupportCenter title="مركز الحلول" /></Surface>;
}
