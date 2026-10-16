import { isValidElement, type ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { DistinguishedBadge } from '@/components/DistinguishedBadge';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { Icon, type IconName } from '@/components/ui/Icon';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { SupportContact } from '@/components/SupportContact';
import { ThemeRow } from '@/components/ThemeRow';
import { TourRow } from '@/tour/TourRow';
import { TourTarget } from '@/tour/TourTarget';
import { useTourScroll } from '@/tour/useTourScroll';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { TeacherLogoRow } from '@/components/teacher/TeacherLogoRow';
import { RevisionSettingsSwitch } from '@/components/teacher/RevisionSwitch';
import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { REVISION_INK } from '@/theme/revision';
import { RevisionRibbon } from '@/components/RevisionRibbon';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useTeacherCourses, useTeacherStudents } from '@/hooks/useStudents';
import { formatDate, formatNumber } from '@/utils/format';
import { Surface, useHiddenSurfaces } from '@/ui/surfaces';
import { Slot } from '@/ui/Slot';

/**
 * Settings (founder 2026-10-03: «some love on the settings page»). A short hero with the
 * person — initial, name, role, phone, badge — then three GROUPED cards instead of one long
 * list of identical rows: «الحساب» (logo · assistants · password), «التطبيق» (appearance ·
 * notifications · revision switch · what's new · getting started) and the support block.
 * Every row keeps its own icon colour so the eye can find it again; sign-out and delete stay
 * at the bottom, apart from everything else.
 *
 * Real per-category notification toggles are still deferred until a push-delivery pipeline
 * exists to gate; the notifications row opens the OS settings.
 */
export default function TeacherSettings() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const isAssistant = user?.user_type_id === 6;
  const season = useRevisionActive();
  const { data: students } = useTeacherStudents();
  const { data: courses } = useTeacherCourses();
  const { data: flags } = useFeatureFlags();

  // The tour scrolls this page to reach «شروحات التطبيق» further down (founder 2026-10-09).
  const tourScroll = useTourScroll();
  return (
    <Surface id="screen.teacher.settings" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView {...tourScroll} contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Surface id="teacher.settings.profile_hero">
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl }}
        >
          {/* Who: the logo or the generated mark in a ring, the name, then role and number as
              two quiet chips (founder 2026-10-11: «some UI love on the top part»). */}
          <RevisionRibbon compact style={{ marginBottom: spacing.md }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ padding: 3, borderRadius: 26, borderWidth: 2, borderColor: colors.onHeroChipBorder, backgroundColor: colors.onHeroChip }}>
              <View style={{ borderRadius: 20, overflow: 'hidden', ...shadows.sm }}>
                {user?.logo_url ? (
                  <Image source={{ uri: user.logo_url }} style={{ width: 66, height: 66, backgroundColor: colors.surface }} contentFit="cover" accessibilityLabel={user?.name ?? ''} />
                ) : (
                  <GeneratedAvatar seed={avatarSeed.user(user?.id, user?.name ?? '?')} size={66} square label={user?.name ?? ''} />
                )}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: colors.onHero }} numberOfLines={2}>{user?.name ?? ''}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Icon name={isAssistant ? 'profile' : 'teacher'} size={13} color={colors.onHero} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onHero }}>{isAssistant ? t('teacher.role_assistant') : t('teacher.role_teacher')}</Text>
                </View>
                {user?.phone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Icon name="phone" size={13} color={colors.onHero} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onHero }}>{user.phone}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          {user?.is_distinguished_member ? (
            <Surface id="teacher.settings.member_badge">
            <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
              <DistinguishedBadge />
            </View>
            </Surface>
          ) : user?.is_founding_teacher ? (
            <Surface id="teacher.settings.member_badge">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, alignSelf: 'flex-start', backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: 'rgba(255,209,102,0.9)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 }}>
              <Icon name="star" size={14} color="#FFD166" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.onHero }}>{t('teacher.founding_member')}</Text>
            </View>
            </Surface>
          ) : null}
          {/* The three numbers that describe this account: from the cached lists the home
              already warms, so they show offline too and cost no new request of their own. */}
          <Surface id="teacher.settings.profile_stats">
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {[
              { value: students ? formatNumber(students.length) : '—', label: t('teacher.tab_students') },
              { value: courses ? formatNumber(courses.length) : '—', label: t('teacher.stat_groups') },
              { value: user?.created_at ? formatDate(user.created_at, { month: 'short', year: 'numeric' }) : '—', label: t('teacher.member_since') },
            ].map((x) => (
              <View key={x.label} style={{ flex: 1, backgroundColor: colors.onHeroChip, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.onHeroChipBorder, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.onHero }} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.onHeroSoft }} numberOfLines={1}>{x.label}</Text>
              </View>
            ))}
          </View>
          </Surface>
        </LinearGradient>
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Surface id="teacher.settings.section_account">
          <SectionLabel text={t('common.section_account')} />
          {/* The teacher's own brand logo (shown to parents) — its own card, teacher-only. */}
          <Surface id="teacher.settings.row_logo" assistantNeeds="teacher"><TeacherLogoRow /></Surface>
          <Group>
            <Surface id="teacher.settings.row_assistants" assistantNeeds="teacher"><Row icon="children" tint={colors.brand} tintBg={colors.brandTint} label={t('assistants.title')} sub={t('assistants.subtitle')} onPress={() => router.push('/(teacher)/assistants' as Href)} /></Surface>
            <Surface id="teacher.settings.row_change_password"><Row icon="lock" tint={colors.success} tintBg={colors.successLight} label={t('auth.change_password')} sub={t('setup.password_hint')} onPress={() => router.push('/change-password')} /></Surface>
          </Group>
          </Surface>

          <Surface id="teacher.settings.section_app">
          <SectionLabel text={t('common.section_app')} />
          <Surface id="teacher.settings.row_tour"><TourRow home={'/(teacher)/(tabs)' as Href} /></Surface>
          <Surface id="teacher.settings.row_theme"><ThemeRow /></Surface>
          <Group>
            <Surface id="teacher.settings.row_notifications"><Row icon="bell" tint={colors.accent} tintBg={colors.accentLight} label={t('teacher.notifications')} sub={t('teacher.notifications_hint')} onPress={() => Linking.openSettings()} /></Surface>
            {/* Revision / special-session switch — teacher only: the revision engine it opens is
                teacher-only on the server. Shown only when the super-admin enabled the flag. */}
            {flags?.revise_mode ? (
              <Surface id="teacher.settings.row_revise_switch" assistantNeeds="teacher">
              <Row
                icon="book"
                tint={season ? REVISION_INK.amber : colors.brand}
                tintBg={season ? colors.accentLight : colors.brandTint}
                label={t('teacher.revise_switch_title')}
                sub={season ? t('revision.settings_hint') : t('teacher.revise_switch_sub')}
                trailing={
                  // The same short confirmation as the Home pill, then the curtain. Its own
                  // component: the toggle follows the route, and this whole page must not.
                  <RevisionSettingsSwitch />
                }
              />
              </Surface>
            ) : null}
            <Surface id="teacher.settings.row_whats_new"><Row icon="star" tint={colors.warningDark} tintBg={colors.warningLight} label={t('whats_new.title')} sub={t('whats_new.all')} onPress={() => router.push('/whats-new' as Href)} /></Surface>
            {/* «شروحات» — the teacher's how-to videos (assistants: none yet). */}
            <Surface id="teacher.settings.row_tutorials" assistantNeeds="teacher">
            <TourTarget id="settings:tutorials">
              <Row icon="play" tint={colors.accent} tintBg={colors.accentLight} label={t('tutorials.title')} sub={t('tutorials.row_sub')} onPress={() => router.push('/(teacher)/tutorials' as Href)} />
            </TourTarget>
            </Surface>
            {/* The setup guide is the teacher's: every step in it is theirs to take. */}
            <Surface id="teacher.settings.row_getting_started" assistantNeeds="teacher"><Row icon="help" tint={colors.info} tintBg={colors.infoLight} label={t('onboarding.getting_started_row')} sub={t('onboarding.getting_started_row_sub')} onPress={() => router.push('/(teacher)/getting-started' as Href)} /></Surface>
          </Group>
          </Surface>

          <Surface id="teacher.settings.support">
          <View style={{ marginTop: spacing.sm }}>
            <SupportContact href={'/(teacher)/resolution' as Href} />
          </View>
          </Surface>

          <Surface id="teacher.settings.section_session">
          <SectionLabel text={t('common.section_session')} />
          <Surface id="teacher.settings.logout">
          <TouchableOpacity
            onPress={() => logout.mutate()}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
              backgroundColor: colors.dangerLight, borderRadius: radius.xl, padding: spacing.lg, minHeight: 56,
            }}
          >
            <Icon name="logout" size={22} color={colors.dangerText} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{t('common.logout')}</Text>
          </TouchableOpacity>
          </Surface>

          <Surface id="teacher.settings.delete_account"><DeleteAccountButton /></Surface>
          <Slot id="teacher.settings.bottom" style={{ marginTop: spacing.xl }} />
          </Surface>
        </View>
      </ScrollView>
    </View>
    </Surface>
  );
}

/** A small, confident section title with the brand rule beside it. */
function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.xs }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.neon }} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, letterSpacing: 0.2 }}>{text}</Text>
    </View>
  );
}

/** One surface card holding several rows, separated by hairlines. */
function Group({ children }: { children: ReactNode }) {
  // A row the backend switched off (a <Surface> whose id is hidden) leaves no hairline behind.
  const hidden = useHiddenSurfaces();
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean)
    .filter((r) => !(isValidElement(r) && r.type === Surface && hidden.has((r.props as { id: string }).id)));
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md, ...shadows.sm }}>
      {rows.map((r, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.borderLight } : null}>{r}</View>
      ))}
    </View>
  );
}

function Row({ icon, tint, tintBg, label, sub, onPress, trailing }: {
  icon: IconName; tint: string; tintBg: string; label: string; sub: string; onPress?: () => void; trailing?: ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64 }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: tintBg, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
        <Icon name={icon} size={21} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{label}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }} numberOfLines={2}>{sub}</Text>
      </View>
      {trailing ?? (onPress ? <Icon name="back" size={20} color={colors.textTertiary} /> : null)}
    </TouchableOpacity>
  );
}
