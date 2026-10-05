import { Tabs } from 'expo-router';
import { colors } from '@/theme/index';
import { type IconName } from '@/components/ui/Icon';
import { NotchTabBar } from '@/components/ui/NotchTabBar';
import { BrandMark } from '@/components/ui/BrandMark';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// The five tabs. Every other student screen lives in the stack around this navigator
// (app/(student)/_layout.tsx), so it has the iOS edge swipe back (founder 2026-10-04).
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","check-in","chat","invoices","profile"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);

// The same notched bar as the teacher and the parent, the app's emblem in the raised middle
// (founder 2026-10-06 — it replaces the stock bar the student kept until now). The middle is
// «سوا»: group chat and threads, a coming-soon screen until they open.
const TAB_ORDER = ['index', 'check-in', 'chat', 'invoices', 'profile'] as const;
const CENTER_TAB = 'chat';
const labels: Record<string, string> = {
  index: 'nav.dashboard',
  'check-in': 'nav.check_in',
  chat: 'together.tab',
  invoices: 'nav.invoices',
  profile: 'nav.profile',
};

const icons: Record<string, IconName> = {
  index: 'home',
  'check-in': 'attendance',
  chat: 'chat',
  invoices: 'invoices',
  profile: 'profile',
};

export default function StudentTabsLayout() {
  // Freezing the hidden tabs is a super-admin FLAG, off by default (react-native-screens #2971).
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
  return (
    <Tabs
      // Hardware back follows visit history, so pushed detail screens (marks, swap,
      // order-card, notifications) pop back to the previous screen instead of jumping
      // to the Home tab.
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
      <Tabs.Screen name="check-in" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
