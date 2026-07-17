import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';

function goToScan(session?: TeacherSession) {
  const name = session?.course_name ?? '';
  router.replace(`/(teacher)/scan?name=${encodeURIComponent(name)}&id=${session?.id ?? ''}`);
}

export default function TeacherHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: sessions, isLoading } = useTeacherTodaySessions();

  const current = (sessions ?? []).filter((s) => s.is_current);

  // Auto-land: exactly one live session → go straight to scanning, zero taps.
  useEffect(() => {
    if (!isLoading && current.length === 1) {
      goToScan(current[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, current.length]);

  const renderSession = (s: TeacherSession) => (
    <TouchableOpacity
      key={s.id}
      onPress={() => goToScan(s)}
      activeOpacity={0.8}
      style={{
        backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', ...shadows.sm,
        minHeight: 64,
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: s.is_current ? colors.successLight : colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
        <Icon name="scan" size={24} color={s.is_current ? colors.success : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{s.course_name ?? '—'}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
          {s.time ?? ''}{s.location ? ` · ${s.location}` : ''}
        </Text>
      </View>
      {s.is_current ? (
        <View style={{ backgroundColor: colors.successLight, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.successText }}>{t('teacher.live_now')}</Text>
        </View>
      ) : (
        <Text style={{ fontSize: 20, color: colors.textTertiary, transform: [{ scaleX: -1 }] }}>‹</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t('teacher.scan_mode')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', marginTop: 2 }}>{user?.name ?? ''}</Text>
        </View>
        <TouchableOpacity onPress={() => logout.mutate()} accessibilityRole="button" accessibilityLabel={t('common.logout')} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="logout" size={22} color="#fff" outline />
        </TouchableOpacity>
      </LinearGradient>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
      ) : !sessions?.length ? (
        <EmptyState icon="calendar" title={t('teacher.no_sessions_today')} message={t('teacher.no_sessions_hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary, marginBottom: spacing.md }}>
            {current.length > 1 ? t('teacher.pick_current_session') : t('teacher.no_live_session')}
          </Text>
          {(current.length > 1 ? current : sessions).map(renderSession)}
          {current.length <= 1 && sessions.length > 0 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md }}>
              {t('teacher.pick_any_hint')}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
