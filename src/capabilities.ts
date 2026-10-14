import { Platform } from 'react-native';
import Constants from 'expo-constants';
import client from '@/api/client';
import { runningUpdate } from '@/updates/otaUpdates';
import { SQLiteStorage } from 'expo-sqlite/kv-store';

/**
 * What THIS build of the app can do, by the keys the backend's config/parity.php names on
 * its `mobile` side. Reported once per build (POST /app-capabilities) so /admin/parity can
 * say which teacher feature the latest app lacks or is behind on (founder 2026-10-11:
 * «an indicator if the dashboard doesn't match the mobile»). Nothing about a person.
 *
 * Keep it honest: add a key only when the screen or action exists in this repo (the test
 * checks every key's `where` file is real), and remove it when the feature goes.
 */
export const CAPABILITIES: ReadonlyArray<{ key: string; where: string }> = [
  { key: 'sessions', where: 'app/(teacher)/(tabs)/sessions.tsx' },
  { key: 'students', where: 'app/(teacher)/(tabs)/students.tsx' },
  { key: 'record_student', where: 'app/(teacher)/record-student.tsx' },
  { key: 'print_market', where: 'app/(teacher)/(tabs)/print.tsx' },
  { key: 'courses', where: 'app/(teacher)/courses/index.tsx' },
  { key: 'venues', where: 'app/(teacher)/venues.tsx' },
  { key: 'relocation', where: 'src/components/teacher/RelocationPrompt.tsx' },
  { key: 'enrollment_terms', where: 'src/components/teacher/EnrollmentTermsSheet.tsx' },
  { key: 'student_transfer', where: 'src/components/teacher/StudentProfile.tsx' },
  { key: 'invoices', where: 'src/components/teacher/StudentDues.tsx' },
  { key: 'cash_reconcile', where: 'app/(teacher)/cash-reconcile.tsx' },
  { key: 'expenses', where: 'app/(teacher)/expenses.tsx' },
  { key: 'rose_export', where: 'src/components/rose/RoseExport.tsx' },
  { key: 'pending_collections', where: 'app/(teacher)/pending-collections.tsx' },
  { key: 'payment_proofs', where: 'app/(teacher)/payment-proofs.tsx' },
  { key: 'billing_settings', where: 'app/(teacher)/billing-settings.tsx' },
  { key: 'complaints', where: 'app/(teacher)/complaints.tsx' },
  { key: 'resolution', where: 'app/(teacher)/resolution.tsx' },
  { key: 'schedule_overrides', where: 'app/(teacher)/schedule-overrides.tsx' },
  { key: 'schedule_merge', where: 'app/(teacher)/schedule-merge.tsx' },
  { key: 'booking_requests', where: 'app/(teacher)/booking-requests.tsx' },
  { key: 'phone_confirmations', where: 'app/(teacher)/phone-confirmations.tsx' },
  { key: 'card_orders', where: 'app/(teacher)/card-order-new.tsx' },
  { key: 'insights', where: 'app/(teacher)/insights.tsx' },
  { key: 'assistant_actions', where: 'app/(teacher)/assistant-actions.tsx' },
  { key: 'assistants', where: 'app/(teacher)/assistants.tsx' },
  { key: 'overrides', where: 'app/(teacher)/overrides.tsx' },
  { key: 'tickets', where: 'app/(teacher)/tickets/index.tsx' },
  { key: 'revisions', where: 'app/(teacher)/revisions.tsx' },
  { key: 'getting_started', where: 'app/(teacher)/getting-started.tsx' },
  { key: 'tutorials', where: 'app/(teacher)/tutorials.tsx' },
  { key: 'notifications', where: 'app/(teacher)/notifications.tsx' },
  { key: 'invite_phone', where: 'app/(teacher)/invite-phone.tsx' },
  { key: 'invite_link', where: 'app/(teacher)/invite-link.tsx' },
  { key: 'settings_logo', where: 'src/components/teacher/TeacherLogoRow.tsx' },
  { key: 'scan', where: 'app/(teacher)/scan.tsx' },
  { key: 'offline', where: 'src/db/autoSync.ts' },
  { key: 'search', where: 'app/(teacher)/search.tsx' },
  { key: 'survey', where: 'src/components/SurveyModal.tsx' },
];

const store = new SQLiteStorage('app-meta');

/** Tell the backend what this build can do — once per build (version + OTA update), silently. */
export async function reportCapabilities(): Promise<boolean> {
  const u = runningUpdate();
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const stamp = `${Platform.OS}|${version}|${u.update_id ?? 'store'}`;
  try {
    if ((await store.getItemAsync('capabilities:reported')) === stamp) return false;
  } catch { /* no store: report anyway, at most once per launch */ }
  try {
    await client.post('/app-capabilities', { platform: Platform.OS, app_version: version, update_id: u.update_id, keys: CAPABILITIES.map((c) => c.key) }, { timeout: 8000 });
    try { await store.setItemAsync('capabilities:reported', stamp); } catch { /* best-effort */ }
    return true;
  } catch {
    return false; // next launch tries again
  }
}
