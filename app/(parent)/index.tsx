import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useChildren } from '@/hooks/useChildren';
import type { Child } from '@/api/children';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar } from '@/components/layout/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timeAgo } from '@/utils/format';

/**
 * Parent Home — "Sanad" simple mode, built for an older parent.
 * One job: understand each child at a glance, then reach the few things that
 * matter with big, word-labelled actions. No raw percentages, no dense grids.
 *
 * A child's line is a PLAIN-LANGUAGE standing derived from real attendance_rate
 * (no fabricated "today" status — that would need a dedicated endpoint).
 */

const notifIcon: Record<string, IconName> = {
  attendance: 'attendance', absence: 'warning', left_early: 'clock', grade: 'grades',
  invoice: 'invoices', invoice_new: 'invoices', invoice_overdue: 'money',
  session_swap: 'calendar', enrollment_transfer: 'calendar', schedule: 'calendar',
  student_report: 'note', daily_digest: 'bell',
};

type Standing = { key: string; color: string };
function standingFor(rate: number): Standing {
  if (rate >= 90) return { key: 'home.standing_excellent', color: colors.success };
  if (rate >= 75) return { key: 'home.standing_good', color: colors.brand };
  return { key: 'home.standing_watch', color: colors.warning };
}

export default function ParentHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: children, isLoading: childrenLoading } = useChildren();
  const { data: notifications } = useNotifications();

  const kids = children ?? [];
  const latest = (notifications ?? [])[0];
  const allWell = kids.length > 0 && kids.every((c) => (c.attendance_rate ?? 0) >= 75);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Deep-ink hero */}
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xxl }}
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.72)' }}>
            {t('home.welcome')}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#fff', marginTop: 2 }}>
            {user?.name || 'ولي الأمر'}
          </Text>
          {kids.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', marginTop: spacing.lg, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg }}>
              <Icon name={allWell ? 'success' : 'warning'} size={20} color={allWell ? '#7FE3B0' : '#F3C77A'} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>
                {t(allWell ? 'home.all_well' : 'home.some_attention')}
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg }}>

          {/* Children */}
          <View style={{ gap: spacing.md }}>
            <Text style={sectionLabel}>{t('home.children_section')}</Text>
            {childrenLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
            ) : (
              kids.map((child) => <ChildCard key={child.id} child={child} t={t} />)
            )}
          </View>

          {/* Actions */}
          <View style={{ gap: spacing.md }}>
            <Text style={sectionLabel}>{t('home.actions_section')}</Text>
            <BigAction
              icon="invoices" tint={colors.successLight} iconColor={colors.success}
              title={t('home.invoices_title')}
              onPress={() => router.push('/(parent)/invoices')}
            />
            <BigAction
              icon="ticket" tint={colors.accentWarmTint} iconColor={colors.accentWarm}
              title={t('home.support_title')} subtitle={t('home.support_sub')}
              onPress={() => router.push('/(parent)/tickets')}
            />
          </View>

          {/* Latest update */}
          <View style={{ gap: spacing.md }}>
            <Text style={sectionLabel}>{t('home.latest_update')}</Text>
            {latest ? (
              <View style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm, borderStartWidth: 4, borderStartColor: colors.brand }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name={notifIcon[latest.type] || 'bell'} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{latest.title}</Text>
                  {latest.body ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary, marginTop: 2 }}>{latest.body}</Text>
                  ) : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 6 }}>{timeAgo(latest.created_at)}</Text>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textTertiary }}>{t('home.no_updates')}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ChildCard({ child, t }: { child: Child; t: (k: string) => string }) {
  const standing = standingFor(child.attendance_rate ?? 0);
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(parent)/child/${child.id}`)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={child.name}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.lg, ...shadows.sm }}
    >
      <Avatar name={child.name} size={58} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary }}>{child.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: standing.color }} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: standing.color }}>{t(standing.key)}</Text>
          {child.grade ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary }}>· {child.grade}</Text>
          ) : null}
        </View>
      </View>
      <Text style={{ fontSize: 28, color: colors.textTertiary, transform: [{ scaleX: -1 }] }}>‹</Text>
    </TouchableOpacity>
  );
}

function BigAction({ icon, tint, iconColor, title, subtitle, onPress }: {
  icon: IconName; tint: string; iconColor: string; title: string; subtitle?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 72, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm }}
    >
      <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: tint, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name={icon} size={26} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 26, color: colors.textTertiary, transform: [{ scaleX: -1 }] }}>‹</Text>
    </TouchableOpacity>
  );
}

const sectionLabel = { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary, marginStart: spacing.xs } as const;
