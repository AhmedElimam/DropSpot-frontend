import { View, Text, ScrollView } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { AVATAR_CHARACTERS, GeneratedAvatar, type AvatarExpression } from '@/components/ui/GeneratedAvatar';

const EXPRESSIONS: AvatarExpression[] = ['smile', 'laugh', 'grin', 'wink', 'wow'];

/**
 * Dev-only gallery: every character in every expression, so a change to the set can be
 * eyeballed in one screen (`exp://…/--/dev-avatars`). Not reachable in a release build.
 */
export default function DevAvatars() {
  const insets = useSafeAreaInsets();
  const { page } = useLocalSearchParams<{ page?: string }>();
  if (!__DEV__) return <Redirect href="/resolve" />;
  // `?page=N` shows 13 characters at a time so a page fits one screenshot.
  const PER = 13;
  const p = Math.max(0, Number(page ?? 0) || 0);
  const slice = AVATAR_CHARACTERS.map((c, i) => [c, i] as const).slice(p * PER, p * PER + PER);
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
      {slice.map(([c, i]) => (
        <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={{ width: 74, fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>{c}</Text>
          {EXPRESSIONS.map((e, j) => (
            <GeneratedAvatar key={e} seed={`gallery-${i}-${j}`} size={52} override={{ character: c, expression: e }} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
