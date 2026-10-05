import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { colors } from '@/theme/index';
import { type IconName } from '@/components/ui/Icon';
import { NotchTabBar } from '@/components/ui/NotchTabBar';
import { BrandMark } from '@/components/ui/BrandMark';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// The five tabs. Every other teacher screen lives in the stack around this navigator
// (app/(teacher)/_layout.tsx), so it is pushed ON TOP of the tabs and gets the iOS edge
// swipe back (founder 2026-10-04: «a lot of pages don't work with the back gesture» —
// they were hidden tabs, and tabs have no back gesture).
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","sessions","manage","students","settings"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);
// The bar, first to last (the first sits at the start edge — the right, in RTL). الإدارة is
// the raised centre button and carries the app's emblem instead of an icon (founder
// 2026-10-03); الحصص stays beside it (founder 2026-10-02: «next to the day»).
const TAB_ORDER = ['index', 'sessions', 'manage', 'students', 'settings'] as const;
const CENTER_TAB = 'manage';

const labels: Record<string, string> = {
  index: 'teacher.tab_home',
  sessions: 'teacher.tab_sessions',
  students: 'teacher.tab_students',
  manage: 'teacher.tab_manage',
  settings: 'teacher.tab_settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  sessions: 'lesson',
  students: 'children',
  manage: 'book',
  settings: 'settings',
};

/** Teacher (and assistant) tabs: home · sessions · manage · students · settings. */
export default function TeacherTabsLayout() {
  // Freezing the hidden tabs (react-freeze) is a FLAG, off by default (2026-10-01): with 5+
  // tabs it is the documented cause of memory growth (react-native-screens #2971).
  // Super-admin flag «تجميد التبويبات المخفية», read from /app-config at launch.
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
  // Memoised: this layout re-renders with the offline badge, and a fresh options object per
  // render re-rendered the whole bar on every sync tick.
  const screenOptions = useMemo<ComponentProps<typeof Tabs>['screenOptions']>(
    () => ({ route }) => ({
      headerShown: false,
      freezeOnBlur: freezeTabs && VISIBLE_TABS.has(route.name),
      // Consistent scene background so a tab switch never flashes a white frame.
      sceneStyle: { backgroundColor: colors.background },
    }),
    [freezeTabs],
  );

  return (
    <Tabs
      // Hardware back between tabs follows the visit history, not "jump to the first tab".
      backBehavior="history"
      tabBar={(props) => <NotchTabBar {...props} tabs={TAB_ORDER} center={CENTER_TAB} labels={labels} icons={icons} centerGlyph={(color) => <BrandMark size={28} tint={color} />} />}
      screenOptions={screenOptions}
      screenLayout={sceneLayout}
    >
      <Tabs.Screen name="index" />
      {/* الحصص — today + history; a session's sheet is pushed on the stack above. */}
      <Tabs.Screen name="sessions" />
      {/* Management hub — four groups: students · schedule · money · follow-up. */}
      <Tabs.Screen name="manage" />
      <Tabs.Screen name="students" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
