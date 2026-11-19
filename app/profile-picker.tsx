import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { useAuthStore } from '@/stores/authStore';
import { readRememberedProfile } from '@/stores/profileChoice';
import { useSharedProfiles, useSwitchProfile, continueAsCurrent } from '@/hooks/useStudentProfiles';
import { ProfileCard } from '@/components/student/ProfileSwitcher';
import { highlightedProfileId, pickAction } from '@/utils/sharedProfiles';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { ROUTE_BY_ROLE } from '@/utils/routes';
import type { StudentProfileEntry } from '@/types/user';

/**
 * «مين بيستخدم التطبيق دلوقتي؟» — siblings sharing one phone (founder 2026-11-19). Shown once
 * right after signing in (app/index.tsx), never on a cold start. The phone holder signed in;
 * tapping him continues, tapping a brother switches the session to him. The choice made last
 * time on this phone is pre-highlighted.
 */
export default function ProfilePickerScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const logout = useAuthStore((s) => s.logout);
  const setPending = useAuthStore((s) => s.setProfilePickPending);
  const { profiles, shared, holderId } = useSharedProfiles();
  const switchProfile = useSwitchProfile();
  const [remembered, setRemembered] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void readRememberedProfile(holderId).then((id) => { if (alive) setRemembered(id); });
    return () => { alive = false; };
  }, [holderId]);

  // Nothing to choose (a list that shrank, a role that is not a student): never come back here.
  useEffect(() => {
    if (isAuthenticated && !shared) setPending(false);
  }, [isAuthenticated, shared, setPending]);

  const highlighted = highlightedProfileId(profiles, remembered, userId);

  if (!isAuthenticated) return <Redirect href={'/(auth)/login' as Href} />;
  if (!shared) return <Redirect href={ROUTE_BY_ROLE} />;

  const pick = (p: StudentProfileEntry) => {
    if (switchProfile.isPending) return;
    if (pickAction(p, userId) === 'continue') { continueAsCurrent(p.user_id); return; }
    switchProfile.mutate(p, {
      onError: (e) => Alert.alert(t('shared_phone.switch_failed'), getFriendlyErrorMessage(e)),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, alignItems: 'center' }}
      >
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.onHeroChip, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
          <Icon name="children" size={38} color={colors.onHero} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.onHero, textAlign: 'center' }}>{t('shared_phone.picker_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.onHeroSoft, textAlign: 'center', marginTop: spacing.xs }}>{t('shared_phone.picker_hint')}</Text>
      </LinearGradient>

      <FlatList
        data={profiles}
        keyExtractor={(p) => String(p.user_id)}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ProfileCard
            profile={item}
            selected={item.user_id === highlighted}
            busy={switchProfile.isPending && switchProfile.variables?.user_id === item.user_id}
            disabled={switchProfile.isPending}
            onPress={() => pick(item)}
          />
        )}
        ListFooterComponent={(
          <TouchableOpacity onPress={() => { void logout(); }} accessibilityRole="button" style={{ marginTop: spacing.md, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textTertiary }}>{t('common.logout')}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
