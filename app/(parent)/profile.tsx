import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
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
import { SupportContact } from '@/components/SupportContact';

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
  const { data: children } = useChildren();

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
      key: 'auth.change_phone',
      icon: 'call',
      color: colors.primary,
      onPress: () => router.push('/(parent)/change-phone' as Href),
    },
    {
      key: 'parent.request_name_correction',
      title: 'طلب تصحيح اسم الطفل',
      icon: 'note',
      color: colors.primary,
      onPress: () => {
        const kids = children ?? [];
        const go = (k: { student_id: number; name: string }) =>
          router.push(`/request-name-correction?studentId=${k.student_id}&studentName=${encodeURIComponent(k.name)}` as Href);
        if (kids.length === 0) { Alert.alert('', 'لا يوجد أطفال مرتبطون بحسابك'); return; }
        if (kids.length === 1) { go(kids[0]); return; }
        Alert.alert('اختر الطفل', 'لأي طفل تريد طلب تصحيح الاسم؟', [
          ...kids.slice(0, 4).map((k) => ({ text: k.name, onPress: () => go(k) })),
          { text: 'إلغاء', style: 'cancel' as const },
        ]);
      },
    },
    {
      key: 'profile.contact_support',
      icon: 'tickets',
      color: colors.success,
      onPress: () => router.push('/(parent)/tickets'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl5, alignItems: 'center' }}
        >
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)', marginBottom: spacing.md }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 36, color: '#fff' }}>{(user?.name || '?')[0]}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{user?.name}</Text>
          {user?.phone ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.8)', marginTop: spacing.xs }}>{user.phone}</Text>
          ) : null}
          <View style={{ marginTop: spacing.md, backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: '#fff' }}>{t('profile.role_parent')}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
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
                كود الطالب وصفّه ورقم هاتفه يديرها المعلّم. لتغيير أيٍّ منها، تواصل مع معلّم الطالب.
              </Text>
            </View>
          </View>

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

          <View style={{ marginBottom: spacing.md }}>
            <SupportContact />
          </View>

          <TouchableOpacity onPress={() => logout.mutate()} activeOpacity={0.85} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            <LinearGradient colors={[colors.dangerDark, colors.danger]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: control.minHeight, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="logout" size={20} color="#fff" outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('common.logout')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <DeleteAccountButton />

          <Text style={[textPresets.caption, { textAlign: 'center', marginTop: spacing.md }]}>DrosSpot v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
