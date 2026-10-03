import type { ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, Switch } from 'react-native';
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
import { TeacherLogoRow } from '@/components/teacher/TeacherLogoRow';
import { useReviseMode, useSetReviseMode } from '@/hooks/useReviseMode';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

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
  const { data: reviseOn } = useReviseMode();
  const { data: flags } = useFeatureFlags();
  const setRevise = useSetReviseMode();
  const initial = (user?.name ?? '?').trim()[0] ?? '?';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xl }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.heroChipActive, justifyContent: 'center', alignItems: 'center', ...shadows.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: 36, color: colors.onHeroChipActive }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.onHero }} numberOfLines={1}>{user?.name ?? ''}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.onHeroSoft, marginTop: 2 }} numberOfLines={1}>
                {isAssistant ? t('teacher.role_assistant') : t('teacher.role_teacher')}
                {user?.phone ? ` · ${user.phone}` : ''}
              </Text>
            </View>
          </View>
          {user?.is_distinguished_member ? (
            <View style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
              <DistinguishedBadge />
            </View>
          ) : user?.is_founding_teacher ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, alignSelf: 'flex-start', backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: 'rgba(255,209,102,0.9)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 }}>
              <Icon name="star" size={14} color="#FFD166" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.onHero }}>عضو مؤسس</Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <SectionLabel text={t('common.section_account')} />
          {/* The teacher's own brand logo (shown to parents) — its own card, teacher-only. */}
          {!isAssistant ? <TeacherLogoRow /> : null}
          <Group>
            {!isAssistant ? (
              <Row icon="children" tint={colors.brand} tintBg={colors.brandTint} label={t('assistants.title')} sub={t('assistants.subtitle')} onPress={() => router.push('/(teacher)/assistants' as Href)} />
            ) : null}
            <Row icon="lock" tint={colors.success} tintBg={colors.successLight} label={t('auth.change_password')} sub={t('setup.password_hint')} onPress={() => router.push('/change-password')} />
          </Group>

          <SectionLabel text={t('common.section_app')} />
          <ThemeRow />
          <Group>
            <Row icon="bell" tint={colors.accent} tintBg={colors.accentLight} label={t('teacher.notifications')} sub={t('teacher.notifications_hint')} onPress={() => Linking.openSettings()} />
            {/* Revision / special-session switch — teacher only: the revision engine it opens is
                teacher-only on the server. Shown only when the super-admin enabled the flag. */}
            {!isAssistant && flags?.revise_mode ? (
              <Row
                icon="reports"
                tint={colors.brand}
                tintBg={colors.brandTint}
                label={t('teacher.revise_switch_title')}
                sub={t('teacher.revise_switch_sub')}
                trailing={
                  <Switch
                    value={!!reviseOn}
                    onValueChange={(v) => setRevise.mutate(v)}
                    disabled={setRevise.isPending || reviseOn === undefined}
                    trackColor={{ true: colors.brand, false: colors.border }}
                    thumbColor={colors.white}
                  />
                }
              />
            ) : null}
            <Row icon="star" tint={colors.warningDark} tintBg={colors.warningLight} label={t('whats_new.title')} sub={t('whats_new.all')} onPress={() => router.push('/whats-new' as Href)} />
            {/* The setup guide is the teacher's: every step in it is theirs to take. */}
            {!isAssistant ? (
              <Row icon="help" tint={colors.info} tintBg={colors.infoLight} label={t('onboarding.getting_started_row')} sub={t('onboarding.getting_started_row_sub')} onPress={() => router.push('/(teacher)/getting-started' as Href)} />
            ) : null}
          </Group>

          <View style={{ marginTop: spacing.sm }}>
            <SupportContact href={'/(teacher)/resolution' as Href} />
          </View>

          <SectionLabel text={t('common.section_session')} />
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

          <DeleteAccountButton />
        </View>
      </ScrollView>
    </View>
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
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
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
