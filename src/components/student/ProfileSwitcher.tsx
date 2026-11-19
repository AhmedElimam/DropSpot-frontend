import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useAuthStore } from '@/stores/authStore';
import { useRefreshSharedProfiles, useSharedProfiles, useSwitchProfile } from '@/hooks/useStudentProfiles';
import { pickAction, profileFirstName, profileSubtitle } from '@/utils/sharedProfiles';
import type { StudentProfileEntry } from '@/types/user';

/**
 * Siblings sharing one phone (founder 2026-11-19): the switcher. Same feel as the assistant's
 * teacher switcher (src/components/teacher/TeacherSwitcher.tsx) — a pill on the home hero and a
 * sheet of choices — plus a row on the profile tab. Renders NOTHING when the phone is not
 * shared, so every other student's screens stay exactly as they were.
 */

/** One student on the phone — the picker's card and the sheet's row. */
export const ProfileCard = memo(function ProfileCard({ profile, selected, checked, busy, disabled, onPress }: {
  profile: StudentProfileEntry;
  /** Highlighted (the current one in the sheet, the remembered one on the picker). */
  selected: boolean;
  /** Draw the check mark. */
  checked?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const sub = profileSubtitle(profile);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: selected ? colors.primaryLight : colors.surface, borderRadius: radius.lg, borderWidth: selected ? 1.5 : 1, borderColor: selected ? colors.primary : colors.border, padding: spacing.lg, marginBottom: spacing.sm }}
    >
      <GeneratedAvatar seed={avatarSeed.student(profile.student_id, avatarSeed.user(profile.user_id, profile.name))} size={44} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{profile.name || '—'}</Text>
          {profile.holds_phone ? (
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }}>{t('shared_phone.holder_mark')}</Text>
            </View>
          ) : null}
        </View>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : checked ? <Icon name="success" size={22} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
});

/** The sheet of profiles: tap one to switch to it (the current one is checked). */
export function ProfileSwitchSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { profiles, current } = useSharedProfiles();
  const switchProfile = useSwitchProfile();
  useRefreshSharedProfiles(visible);

  const pick = (p: StudentProfileEntry) => {
    if (pickAction(p, current?.user_id ?? userId) === 'continue') { onClose(); return; }
    // Close first: the root's cover is the loader, and a sheet (its own native window) would sit over it.
    onClose();
    switchProfile.mutate(p, {
      onError: (e) => Alert.alert(t('shared_phone.switch_failed'), getFriendlyErrorMessage(e)),
    });
  };

  return (
    <SheetModal visible={visible} onClose={onClose} style={{ backgroundColor: colors.background, paddingTop: spacing.xl, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl, maxHeight: '70%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('shared_phone.sheet_title')}</Text>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Icon name="forward" size={24} color={colors.textSecondary} /></TouchableOpacity>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.lg }}>{t('shared_phone.sheet_hint')}</Text>
      <FlatList
        data={profiles}
        keyExtractor={(p) => String(p.user_id)}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isCurrent = item.user_id === current?.user_id;
          return (
            <ProfileCard
              profile={item}
              selected={isCurrent}
              checked={isCurrent}
              busy={switchProfile.isPending && switchProfile.variables?.user_id === item.user_id}
              disabled={switchProfile.isPending}
              onPress={() => pick(item)}
            />
          );
        }}
      />
    </SheetModal>
  );
}

/** The home hero's pill: the current first name + a swap mark. Nothing when the phone is not shared. */
export function ProfileSwitchChip() {
  const { shared, current } = useSharedProfiles();
  const [open, setOpen] = useState(false);
  if (!shared) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.md, alignSelf: 'center', marginTop: spacing.sm }}
      >
        <Icon name="transfer" size={14} color={colors.onHero} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.onHero, maxWidth: 180 }} numberOfLines={1}>{profileFirstName(current) || '—'}</Text>
        <Icon name="down" size={14} color={colors.onHero} />
      </TouchableOpacity>
      <ProfileSwitchSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The profile tab's row «تبديل الملف — الرقم ده مشترك». Nothing when the phone is not shared. */
export function ProfileSwitchRow() {
  const { t } = useTranslation();
  const { shared, profiles, current } = useSharedProfiles();
  const [open, setOpen] = useState(false);
  if (!shared) return null;
  const others = profiles.filter((p) => p.user_id !== current?.user_id).map((p) => profileFirstName(p)).filter(Boolean).join('، ');

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
          <Icon name="transfer" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={textPresets.body}>{t('shared_phone.row_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>
            {others ? t('shared_phone.row_hint_with', { names: others }) : t('shared_phone.row_hint')}
          </Text>
        </View>
        <Icon name="back" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
      <ProfileSwitchSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
