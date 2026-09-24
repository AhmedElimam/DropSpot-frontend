import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * Where `drosspot://scan` lands — the deep link a student card's QR produces.
 *
 * The card's QR points at drosspot.app/q, which hands off to this route when the app is
 * installed and to the right app store when it is not (see CardScanLinkController on the
 * server). So whoever opens it, we already know one thing: they just pointed a camera at a
 * Dros Spot card. What that should mean depends entirely on who they are.
 *
 * The scanned credential arrives as `code`. It is deliberately NOT forwarded to the scanner:
 * checking a student in is done against a CHOSEN SESSION, and this route has no idea which
 * session the teacher means. Feeding a code into the scanner before that choice is made would
 * either guess the session or need a new silent code path into attendance. Opening the camera
 * with the card still in the teacher's hand costs one real second and keeps attendance going
 * through the one door it already goes through.
 */
export default function ScanDeepLink() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  // Accepted so the link shape is stable, and so a future version can use it without the
  // printed cards having to change again. Cards outlive app releases.
  useLocalSearchParams<{ code?: string }>();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // A teacher or their assistant scanned a card: this is a check-in, so give them the camera.
  if (role === 'teacher' || role === 'assistant') {
    return <Redirect href={'/(teacher)/scan' as Href} />;
  }

  // Anyone else pointed a phone at a card — most often a student or parent at their own.
  // There is nothing for them to scan, so send them home through the normal role router,
  // which also re-applies every gate (terms, password, the self-registration wall).
  return <Redirect href="/" />;
}
