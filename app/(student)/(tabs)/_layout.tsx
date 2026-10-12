import { Tabs } from 'expo-router';
import { useHiddenSurfaces } from '@/ui/surfaces';
import { colors } from '@/theme/index';
import { type IconName } from '@/components/ui/Icon';
import { NotchTabBar } from '@/components/ui/NotchTabBar';
import { BrandMark } from '@/components/ui/BrandMark';
import { boundedSceneLayout } from '@/navigation/boundedScenes';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useChatEnabled } from '@/hooks/useChat';
import { useThreadsEnabled } from '@/hooks/useThreads';

// The five tabs. Every other student screen lives in the stack around this navigator
// (app/(student)/_layout.tsx), so it has the iOS edge swipe back (founder 2026-10-04).
const VISIBLE_TABS: ReadonlySet<string> = new Set(["index","check-in","chat","invoices","profile"]);
const sceneLayout = boundedSceneLayout(VISIBLE_TABS);

// The same notched bar as the teacher and the parent, the app's emblem in the raised middle
// (founder 2026-10-06 — it replaces the stock bar the student kept until now). The middle is
// «مجموعاتي»: group chat and threads — the real conversations while either flag is on
// (threads branch), the coming-soon screen while both are off.
const TAB_ORDER = ['index', 'check-in', 'chat', 'invoices', 'profile'] as const;
const CENTER_TAB = 'chat';
const labels: Record<string, string> = {
  index: 'nav.dashboard',
  'check-in': 'nav.check_in',
  chat: 'together.tab',
  invoices: 'nav.invoices',
  // Short on purpose: «الملف الشخصي» ran into the screen edge on the five-tab bar.
  profile: 'nav.profile_short',
};

const icons: Record<string, IconName> = {
  index: 'home',
  'check-in': 'attendance',
  chat: 'chat',
  invoices: 'invoices',
  profile: 'profile',
};

export default function StudentTabsLayout() {
  // A tab the backend code switched off (server config/mobile_ui.php → `tab.student.<name>`)
  // leaves the bar; the raised centre falls back to the middle of what is left.
  const hiddenSurfaces = useHiddenSurfaces();
  const tabs = TAB_ORDER.filter((n) => !hiddenSurfaces.has(`tab.student.${n}`));
  const center = tabs.includes(CENTER_TAB) ? CENTER_TAB : (tabs[Math.floor(tabs.length / 2)] ?? CENTER_TAB);
  // Freezing the hidden tabs is a super-admin FLAG, off by default (react-native-screens #2971).
  const freezeTabs = useFeatureFlags().data?.freeze_hidden_tabs === true;
  // The centre tab is named after whichever conversation surface is on (both → «المحادثات»).
  const chatEnabled = useChatEnabled();
  const threadsEnabled = useThreadsEnabled();
  const tabLabels = chatEnabled || threadsEnabled
    ? { ...labels, chat: chatEnabled && threadsEnabled ? 'chat.conversations' : threadsEnabled ? 'threads.tab' : 'nav.chat' }
    : labels;
  const tabIcons = !chatEnabled && threadsEnabled ? { ...icons, chat: 'threads' as IconName } : icons;
  return (
    <Tabs
      // Hardware back follows visit history, so pushed detail screens (marks, swap,
      // order-card, notifications) pop back to the previous screen instead of jumping
      // to the Home tab.
      backBehavior="history"
      screenLayout={sceneLayout}
      tabBar={(props) => <NotchTabBar {...props} tabs={tabs} center={center} labels={tabLabels} icons={tabIcons} centerGlyph={(color) => <BrandMark size={28} tint={color} />} />}
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
