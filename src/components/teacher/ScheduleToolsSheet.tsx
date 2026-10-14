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
import { Surface } from '@/ui/surfaces';

/**
 * «الجدول» from Home (founder 2026-10-08: «a shortcut, easy access to the scheduling tools,
 * with a modal like the student invite»). The same tools as Management's «الجدول» group, one
 * tap away in a sheet: courses, a new course, a new weekly slot, an exam / special session,
 * revision sessions, pausing a period, merging two groups, Ramadan times and the venues.
 * Each row shows only to someone who may use it — the same gates as Management (an assistant
 * never sees a tool they cannot use). Who may is the row's surface gate (`assistantNeeds`),
 * so the server's `ui.gates` can widen it; `show` is only the feature flags.
 */
export function ScheduleToolsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: flags } = useFeatureFlags();
  const { data: reviseOn } = useReviseMode();
  const go = (href: Href) => { onClose(); setTimeout(() => router.push(href), 60); };

  const options: { surface: string; assistantNeeds?: string; icon: IconName; title: string; sub: string; href: Href; show: boolean }[] = [
    { surface: 'teacher.schedule_tools.row_courses', icon: 'book', title: t('teacher.courses_title'), sub: t('manage.courses_sub'), href: '/(teacher)/courses' as Href, show: true },
    { surface: 'teacher.schedule_tools.row_new_course', assistantNeeds: 'manage_courses', icon: 'add', title: t('schedule_tools.new_course'), sub: t('schedule_tools.new_course_sub'), href: '/(teacher)/courses/create' as Href, show: true },
    { surface: 'teacher.schedule_tools.row_special_sessions', assistantNeeds: 'manage_sessions', icon: 'reports', title: t('teacher.special_sessions_title'), sub: t('teacher.special_sessions_sub'), href: '/(teacher)/exam-create' as Href, show: true },
    { surface: 'teacher.schedule_tools.row_revisions', assistantNeeds: 'teacher', icon: 'book', title: t('teacher.revision_mode_row'), sub: t('teacher.revision_mode_row_sub'), href: '/(teacher)/revisions' as Href, show: !!flags?.revise_mode && reviseOn !== false },
    { surface: 'teacher.schedule_tools.row_pause', assistantNeeds: 'cancel_sessions', icon: 'clock', title: t('teacher.pause_period'), sub: t('teacher.pause_sub'), href: '/(teacher)/pause' as Href, show: true },
    { surface: 'teacher.schedule_tools.row_schedule_merge', assistantNeeds: 'manage_courses', icon: 'transfer', title: t('teacher.merge_title'), sub: t('teacher.merge_sub'), href: '/(teacher)/schedule-merge' as Href, show: true },
    { surface: 'teacher.schedule_tools.row_schedule_overrides', assistantNeeds: 'manage_courses', icon: 'clock', title: t('teacher.overrides_title'), sub: t('teacher.overrides_sub'), href: '/(teacher)/schedule-overrides' as Href, show: !!flags?.ramadan_schedule },
    { surface: 'teacher.schedule_tools.row_print', assistantNeeds: 'teacher', icon: 'print', title: t('print.tools_row'), sub: t('print.tools_row_sub'), href: '/(teacher)/print' as Href, show: !!flags?.print_market },
    { surface: 'teacher.schedule_tools.row_venues', assistantNeeds: 'teacher', icon: 'gps', title: t('manage.venues_title'), sub: t('manage.venues_sub'), href: '/(teacher)/venues' as Href, show: true },
  ];

  return (
    <SheetModal visible={visible} onClose={onClose} style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '88%' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: 2 }}>{t('schedule_tools.title')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg }}>{t('schedule_tools.subtitle')}</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {options.filter((o) => o.show).map((o) => (
          <Surface key={o.surface} id={o.surface} assistantNeeds={o.assistantNeeds}>
          <TouchableOpacity onPress={() => go(o.href)} activeOpacity={0.8} accessibilityRole="button"
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
          </Surface>
        ))}
      </ScrollView>
    </SheetModal>
  );
}
