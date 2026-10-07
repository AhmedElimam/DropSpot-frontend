import { SheetModal } from '@/components/ui/SheetModal';
import { View, Text, TouchableOpacity } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useReviseMode } from '@/hooks/useReviseMode';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';

/**
 * «الجدول» from Home (founder 2026-10-08: «a shortcut, easy access to the scheduling tools,
 * with a modal like the student invite»). The same tools as Management's «الجدول» group, one
 * tap away in a sheet: courses, a new course, a new weekly slot, an exam / special session,
 * revision sessions, pausing a period, merging two groups, Ramadan times and the venues.
 * Each row shows only to someone who may use it — the same gates as Management (an assistant
 * never sees a tool they cannot use).
 */
export function ScheduleToolsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can, isAssistant } = useActiveAbilities();
  const { data: flags } = useFeatureFlags();
  const { data: reviseOn } = useReviseMode();
  const go = (href: Href) => { onClose(); setTimeout(() => router.push(href), 60); };

  const canCourses = can(ABILITY.MANAGE_COURSES);
  const canSessions = can(ABILITY.MANAGE_SESSIONS);

  const options: { icon: IconName; title: string; sub: string; href: Href; show: boolean }[] = [
    { icon: 'book', title: t('teacher.courses_title'), sub: t('manage.courses_sub'), href: '/(teacher)/courses' as Href, show: true },
    { icon: 'add', title: t('schedule_tools.new_course'), sub: t('schedule_tools.new_course_sub'), href: '/(teacher)/courses/create' as Href, show: canCourses },
    { icon: 'calendar', title: t('schedule_tools.new_slot'), sub: t('schedule_tools.new_slot_sub'), href: '/(teacher)/schedule-new' as Href, show: canSessions },
    { icon: 'reports', title: t('teacher.special_sessions_title'), sub: t('teacher.special_sessions_sub'), href: '/(teacher)/exam-create' as Href, show: canSessions },
    { icon: 'book', title: t('teacher.revision_mode_row'), sub: t('teacher.revision_mode_row_sub'), href: '/(teacher)/revisions' as Href, show: !isAssistant && !!flags?.revise_mode && reviseOn !== false },
    { icon: 'clock', title: t('teacher.pause_period'), sub: t('teacher.pause_sub'), href: '/(teacher)/pause' as Href, show: can(ABILITY.CANCEL_SESSIONS) },
    { icon: 'transfer', title: t('teacher.merge_title'), sub: t('teacher.merge_sub'), href: '/(teacher)/schedule-merge' as Href, show: canCourses },
    { icon: 'clock', title: t('teacher.overrides_title'), sub: t('teacher.overrides_sub'), href: '/(teacher)/schedule-overrides' as Href, show: canCourses && !!flags?.ramadan_schedule },
    { icon: 'gps', title: t('manage.venues_title'), sub: t('manage.venues_sub'), href: '/(teacher)/venues' as Href, show: !isAssistant },
  ];

  return (
    <SheetModal visible={visible} onClose={onClose} style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '88%' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: 2 }}>{t('schedule_tools.title')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>{t('schedule_tools.subtitle')}</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {options.filter((o) => o.show).map((o) => (
          <TouchableOpacity key={o.title} onPress={() => go(o.href)} activeOpacity={0.8} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 64, marginBottom: spacing.sm }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accentLight, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name={o.icon} size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{o.title}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 2 }}>{o.sub}</Text>
            </View>
            <Icon name="back" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SheetModal>
  );
}
