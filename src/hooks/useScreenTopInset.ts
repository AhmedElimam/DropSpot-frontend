import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';

/**
 * The status-bar space a screen's own header leaves at its top. While the impersonation banner
 * is up it already sits under the status bar and pushes every screen below it, so the space was
 * left twice: a tall empty band over the ticket (founder 2026-11-02).
 */
export function useScreenTopInset(): number {
  const insets = useSafeAreaInsets();
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  return impersonating ? 0 : insets.top;
}
