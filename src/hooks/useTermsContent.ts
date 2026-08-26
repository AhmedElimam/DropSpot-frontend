import { useQuery } from '@tanstack/react-query';
import { getTermsContent, type TermsRoleContent, type TermsRole } from '@/api/terms';

/**
 * Live, super-admin-editable Terms content, with the app's bundled i18n copy as the
 * fallback. Never throws or blocks: if the fetch fails, callers use the bundled
 * strings. Public endpoint, so it works on the pre-auth registration screen too.
 */
export function useTermsContent() {
  const { data } = useQuery({
    queryKey: ['terms-content'],
    queryFn: getTermsContent,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  return {
    /** Server content for a role, or null → caller falls back to bundled i18n. */
    contentFor(role: TermsRole): TermsRoleContent | null {
      return data?.roles?.[role] ?? null;
    },
  };
}
