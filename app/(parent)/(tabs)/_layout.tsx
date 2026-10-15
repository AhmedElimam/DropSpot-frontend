import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useHiddenSurfaces } from '@/ui/surfaces';
import { colors } from '@/theme/index';
import { type IconName } from '@/components/ui/Icon';
import { NotchTabBar } from '@/components/ui/NotchTabBar';
import { BrandMark } from '@/components/ui/BrandMark';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useThreadsEnabled, useThreadsUnread } from '@/hooks/useThreads';

// The five tabs. Every other parent screen (a child, reports, tickets, notifications…) lives
// in the stack around this navigator (app/(parent)/_layout.tsx), so it is pushed on top of
// the tabs and has the iOS edge swipe back (founder 2026-10-04).
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","community","teachers","invoices","profile"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);

// Five large, always-labelled tabs, «مجتمعنا» raised in the middle with the app's emblem (founder
// 2026-10-06, like the student's «مجموعاتي»; «أبنائي» held the middle until then and now opens
// from Home's children section).
// (founder 2026-10-04, like the teacher's الإدارة; 2026-10-03: «a cut
// design on the middle nav for the most important tab»). Tickets left the bar on 2026-10-03
// (Home's «المساعدة والدعم» opens them) so the bar has a middle.
const TAB_ORDER = ['index', 'teachers', 'community', 'invoices', 'profile'] as const;
const CENTER_TAB = 'community';
const labels: Record<string, string> = {
  index: 'nav.home',
  community: 'community.tab',
  teachers: 'parent.teachers',
  invoices: 'nav.invoices',
  profile: 'nav.settings',
};

const icons: Record<string, IconName> = {
  index: 'home',
  community: 'chat',
  teachers: 'teacher',
  invoices: 'invoices',
  profile: 'settings',
};

export default function ParentTabsLayout() {
  // A tab the backend code switched off (server config/mobile_ui.php → `tab.parent.<name>`)
  // leaves the bar; the raised centre falls back to the middle of what is left.
  const hiddenSurfaces = useHiddenSurfaces();
  const tabs = TAB_ORDER.filter((n) => !hiddenSurfaces.has(`tab.parent.${n}`));
  const center = tabs.includes(CENTER_TAB) ? CENTER_TAB : (tabs[Math.floor(tabs.length / 2)] ?? CENTER_TAB);
  // Freezing the hidden tabs is a super-admin FLAG, off by default (react-native-screens #2971).
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
  // New حكاوي since the parent last looked ride on «مجتمعنا» (founder 2026-10-15) — parents get
  // no push per post, so the badge is how they hear about one. Off with the flag.
  const threadsEnabled = useThreadsEnabled();
  const { data: threadsUnread } = useThreadsUnread(threadsEnabled);
  const badges = useMemo(() => ({ community: threadsEnabled ? threadsUnread ?? 0 : 0 }), [threadsEnabled, threadsUnread]);
  return (
    <Tabs
      // Hardware back between tabs follows the visit history.
      backBehavior="history"
      screenLayout={sceneLayout}
      tabBar={(props) => <NotchTabBar {...props} tabs={tabs} center={center} labels={labels} icons={icons} badges={badges} centerGlyph={(color) => <BrandMark size={28} tint={color} />} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: freezeTabs && VISIBLE_TABS.has(route.name),
        sceneStyle: { backgroundColor: colors.background },
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="teachers" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
