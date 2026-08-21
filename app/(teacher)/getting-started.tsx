import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTeacherOnboarding } from '@/hooks/useTeacherOnboarding';

/**
 * Getting Started — a persistent, always-available reference of the onboarding
 * content (the mandatory walkthrough + the four contextual tips). Reached from
 * Settings so a teacher who dismissed a tip too quickly, or wants a refresher
 * later, can revisit it on their own without the contextual moment recurring.
 */
export default function GettingStarted() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: state } = useTeacherOnboarding();

  const steps = state?.steps;
  const tips = state?.tips;

  const groups: {
    title: string;
    items: {
      icon: IconName;
      titleKey: string;
      bodyKey: string;
      done?: boolean;
      go?: Href;
    }[];
  }[] = [
    {
      title: t('onboarding.gs_group_setup'),
      items: [
        { icon: 'book', titleKey: 'onboarding.gs_course_title', bodyKey: 'onboarding.gs_course_body', done: steps?.course_form, go: '/(teacher)/courses/create' as Href },
        { icon: 'calendar', titleKey: 'onboarding.gs_sessions_title', bodyKey: 'onboarding.gs_sessions_body', done: steps?.sessions },
      ],
    },
    {
      title: t('onboarding.gs_group_daily'),
      items: [
        { icon: 'add', titleKey: 'onboarding.gs_invite_title', bodyKey: 'onboarding.tip_invitation_body', done: tips?.invitation, go: '/(teacher)/enroll' as Href },
        { icon: 'scan', titleKey: 'onboarding.gs_attendance_title', bodyKey: 'onboarding.tip_attendance_body', done: tips?.attendance, go: '/(teacher)/scan' as Href },
        { icon: 'money', titleKey: 'onboarding.gs_billing_title', bodyKey: 'onboarding.tip_billing_body', done: tips?.billing, go: '/(teacher)/collect' as Href },
        { icon: 'reports', titleKey: 'onboarding.gs_reports_title', bodyKey: 'onboarding.tip_reports_body', done: tips?.reports, go: '/(teacher)/resolution' as Href },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('onboarding.getting_started_title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.lg }}>
          {t('onboarding.getting_started_intro')}
        </Text>

        {groups.map((g) => (
          <View key={g.title} style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }}>{g.title}</Text>
            {g.items.map((item) => (
              <TouchableOpacity
                key={item.titleKey}
                activeOpacity={item.go ? 0.8 : 1}
                onPress={() => item.go && router.push(item.go)}
                style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name={item.icon} size={22} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}>{t(item.titleKey)}</Text>
                    {item.done ? <Icon name="success" size={16} color={colors.success} /> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary, textAlign: 'right', marginTop: 4 }}>{t(item.bodyKey)}</Text>
                </View>
                {item.go ? <Icon name="back" size={18} color={colors.textTertiary} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
