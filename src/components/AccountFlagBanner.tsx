import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { getMyAccountFlag } from '@/api/profile';

/**
 * A confirmed flag on this family, on the parent's and the student's own profile (founder
 * 2026-11-26). The parent sees their own, a student their parent's; the server writes the words.
 * Asked for on the screen rather than read from the session alone, which can be two weeks old;
 * the session's copy shows first so there is no blank moment.
 */
export function AccountFlagBanner() {
  const fromSession = useAuthStore((s) => s.user?.account_flag_message ?? null);
  const { data } = useQuery({ queryKey: ['me', 'account-flag'], queryFn: getMyAccountFlag, staleTime: 60_000 });
  const message = data ? data.message : fromSession;
  if (!message) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, padding: spacing.md }}>
      <Icon name="warning" size={18} color={colors.dangerText} />
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.dangerText }}>{message}</Text>
    </View>
  );
}
