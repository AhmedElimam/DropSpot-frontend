import { View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { Alert } from '@/ui/dialog';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { SupportContact } from '@/components/SupportContact';
import { ThemeRow } from '@/components/ThemeRow';
import { TourRow } from '@/tour/TourRow';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients, control } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { formatDate } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';
import { DeleteAccountButton } from '@/components/DeleteAccountButton';
import { PageHero } from '@/components/ui/PageHero';
import { avatarSeed } from '@/components/ui/GeneratedAvatar';
import { Surface } from '@/ui/surfaces';

interface SettingItem {
  key: string;
  title?: string; // raw label overriding the i18n key
  icon: IconName;
  color: string;
  onPress: () => void;
}

export default function ParentSettings() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: children, refetch: refetchChildren } = useChildren();
  // Pull to refresh like every other tab (founder 2026-10-18).
  const { refreshing, onRefresh } = usePullRefresh(refetchChildren);

  // Every row does something real — no dead settings (elderly-usability rule)
  const settings: SettingItem[] = [
    {
      key: 'profile.notifications',
      icon: 'bell',
      color: colors.primary,
      onPress: () => router.push('/notification-preferences' as Href),
    },
    {
      key: 'auth.change_password',
      icon: 'lock',
      color: colors.accentWarm ?? colors.primary,
      onPress: () => router.push('/change-password'),
    },
    {
      key: 'parent.edit_name',
      title: t('family_ui.edit_name'),
      icon: 'note',
      color: colors.primary,
      onPress: () => router.push('/(parent)/change-name' as Href),
    },
    {
      key: 'auth.change_phone',
      icon: 'call',
      color: colors.primary,
      onPress: () => router.push('/(parent)/change-phone' as Href),
    },
    {
      key: 'parent.request_name_correction',
      title: t('family_ui.child_name_fix'),
      icon: 'note',
      color: colors.primary,
      onPress: () => {
        const kids = children ?? [];
        const go = (k: { student_id: number; name: string }) =>
          router.push(`/request-name-correction?studentId=${k.student_id}&studentName=${encodeURIComponent(k.name)}` as Href);
        if (kids.length === 0) { Alert.alert('', t('family_ui.no_children_linked')); return; }
        if (kids.length === 1) { go(kids[0]); return; }
        Alert.alert(t('family_ui.pick_child_title'), t('family_ui.pick_child_body'), [
          ...kids.slice(0, 4).map((k) => ({ text: k.name, onPress: () => go(k) })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]);
      },
    },
  ];

  return (
    <Surface id="screen.parent.profile" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <Surface id="parent.profile.hero">
        <PageHero title={user?.name ?? ''} subtitle={user?.phone ?? undefined} avatar={avatarSeed.user(user?.id, user?.name ?? '?')}>
        <View style={{ alignSelf: 'flex-start', marginTop: spacing.md, backgroundColor: colors.onHeroChip, paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.onHero }}>{t('profile.role_parent')}</Text>
        </View>
        </PageHero>
        </Surface>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          <Surface id="parent.profile.account">
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.account')}
            </Text>
            {settings.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                onPress={item.onPress}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.md, borderBottomWidth: index < settings.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: item.color + '18', justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                  <Icon name={item.icon} size={20} color={item.color} outline />
                </View>
                <Text style={[textPresets.body, { flex: 1 }]}>{item.title ?? t(item.key)}</Text>
                <Icon name="back" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
            {/* Tier C — a parent may request a child's name correction (above) but the code,
                grade and the student's own login number are teacher-managed. Make that legible. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <Icon name="lock" size={16} color={colors.textTertiary} outline />
              <Text style={[textPresets.caption, { flex: 1, lineHeight: 18 }]}>
                {t('family_ui.parent_locked_fields')}
              </Text>
            </View>
          </View>
          </Surface>

          <Surface id="parent.profile.account_info">
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.sm }}>
            <Text style={[textPresets.label, { marginBottom: spacing.md, color: colors.textTertiary }]}>
              {t('profile.account_info')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('profile.member_since')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>
                {user?.created_at ? formatDate(new Date(user.created_at), { month: 'long', year: 'numeric' }) : '-'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text style={textPresets.bodySmall}>{t('parent.my_children')}</Text>
              <Text style={[textPresets.bodySmall, { fontFamily: fonts.medium, color: colors.textPrimary }]}>{children?.length ?? 0}</Text>
            </View>
          </View>
          </Surface>

          {/* The family's conversations with its teachers — easy to miss as a home tile alone. */}
          <Surface id="parent.profile.tickets_entry">
          <TouchableOpacity
            onPress={() => router.push('/(parent)/tickets' as Href)}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}
          >
            <Icon name="ticket" size={20} color={colors.accentWarm} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('parent.teacher_tickets_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{t('parent.teacher_tickets_sub')}</Text>
            </View>
            <Icon name="back" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          </Surface>

          <View style={{ marginBottom: spacing.md }}>
            <Surface id="parent.profile.tour"><TourRow home={'/(parent)/(tabs)' as Href} /></Surface>
            <Surface id="parent.profile.theme"><ThemeRow /></Surface>
            <Surface id="parent.profile.support"><SupportContact href={'/(parent)/support' as Href} /></Surface>
          </View>

          <Surface id="parent.profile.logout">
          <TouchableOpacity onPress={() => logout.mutate()} activeOpacity={0.85} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            <LinearGradient colors={[colors.dangerDark, colors.danger]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: control.minHeight, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="logout" size={20} color="#fff" outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('common.logout')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          </Surface>

          <Surface id="parent.profile.delete_account"><DeleteAccountButton /></Surface>

          <Text style={[textPresets.caption, { textAlign: 'center', marginTop: spacing.md }]}>DrosSpot v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
    </Surface>
  );
}
