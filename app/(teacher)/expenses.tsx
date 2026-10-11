import { useDialogPersona } from '@/ui/dialog';
import { useLocalSearchParams } from 'expo-router';
import { ExpensesPanel } from '@/components/cash/ExpensesPanel';
import { Surface } from '@/ui/surfaces';

/**
 * /expenses — the standalone route for deep links and observation traces
 * (?from&to[&category][&venue]). Day to day the ledger lives inside مدام روز's hub.
 */
export default function ExpensesScreen() {
  // Every popup here is مدام روز's (the system alert replacement, src/ui/dialog.tsx).
  useDialogPersona('rose');
  const params = useLocalSearchParams<{ from?: string; to?: string; category?: string; venue?: string }>();
  const trace = params.from && params.to ? { from: params.from, to: params.to, category: params.category, venue: params.venue } : null;

  return (
    <Surface id="screen.teacher.expenses" screen>
      <ExpensesPanel initialTrace={trace} />
    </Surface>
  );
}
