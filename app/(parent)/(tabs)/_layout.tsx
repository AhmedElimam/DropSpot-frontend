import { Tabs } from 'expo-router';
import { colors } from '@/theme/index';
import { type IconName } from '@/components/ui/Icon';
import { NotchTabBar } from '@/components/ui/NotchTabBar';
import { BrandMark } from '@/components/ui/BrandMark';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// The five tabs. Every other parent screen (a child, reports, tickets, notifications…) lives
// in the stack around this navigator (app/(parent)/_layout.tsx), so it is pushed on top of
// the tabs and has the iOS edge swipe back (founder 2026-10-04).
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","children","teachers","invoices","profile"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);

// Five large, always-labelled tabs, أبنائي raised in the middle with the app's emblem
// (founder 2026-10-04, like the teacher's الإدارة; 2026-10-03: «a cut
// design on the middle nav for the most important tab»). Tickets left the bar on 2026-10-03
// (Home's «المساعدة والدعم» opens them) so the bar has a middle.
const TAB_ORDER = ['index', 'teachers', 'children', 'invoices', 'profile'] as const;
const CENTER_TAB = 'children';
const labels: Record<string, string> = {
  index: 'nav.home',
  children: 'nav.children',
  teachers: 'parent.teachers',
  invoices: 'nav.invoices',
  profile: 'nav.settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  children: 'kids',
  teachers: 'teacher',
  invoices: 'invoices',
  profile: 'settings',
};

export default function ParentTabsLayout() {
  // Freezing the hidden tabs is a super-admin FLAG, off by default (react-native-screens #2971).
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
  return (
    <Tabs
      // Hardware back between tabs follows the visit history.
      backBehavior="history"
      screenLayout={sceneLayout}
      tabBar={(props) => <NotchTabBar {...props} tabs={TAB_ORDER} center={CENTER_TAB} labels={labels} icons={icons} centerGlyph={(color) => <BrandMark size={28} tint={color} />} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: freezeTabs && VISIBLE_TABS.has(route.name),
        sceneStyle: { backgroundColor: colors.background },
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="children" />
      <Tabs.Screen name="teachers" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
