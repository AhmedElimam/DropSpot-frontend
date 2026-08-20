  import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * The redesign's bottom shell (spec 3.9): a translucent surface bar with a
 * raised brand-gradient center button for each role's primary action — scan
 * (teacher), check-in (student), reports (parent). The center route is lifted
 * out of the strip and rendered as the floating FAB.
 *
 * Driven by an EXPLICIT `tabs` list, not `state.routes` — with a custom tabBar
 * expo-router still includes `href: null` screens (swap, order-card…) in
 * `state.routes`, so relying on it renders phantom tabs. `tabs` is the ordered
 * list of side-tab route names (visual right→left in RTL); `center` is the FAB.
 */

interface RaisedTabBarProps extends BottomTabBarProps {
  /** Ordered side-tab route names (visual right→left). Excludes the center. */
  tabs: string[];
  icons: Record<string, IconName>;
  /** Resolved (translated) labels keyed by route name. */
  labels: Record<string, string>;
  center: { name: string; icon: IconName };
  /** Force-hide the bar (e.g. the center route is a full-screen camera). */
  hidden?: boolean;
  /** Small count bubble on the FAB — e.g. the teacher's unsynced-scan count. */
  centerBadge?: number;
}

export function RaisedTabBar({ state, navigation, tabs, icons, labels, center, hidden, centerBadge }: RaisedTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  const keyOf = (name: string) => state.routes.find((r) => r.name === name)?.key;

  // Full-screen surfaces (a live camera on the center route, an open conversation):
  // the layout computes this since a custom tabBar can't read per-screen tabBarStyle.
  if (hidden) return null;

  // Hide the bar on hidden pushed screens (href:null flows like swap/order-card):
  // a custom tabBar ignores each screen's `tabBarStyle`, so guard here instead.
  if (activeName && activeName !== center.name && !tabs.includes(activeName)) {
    return null;
  }

  const go = (routeName: string) => {
    const key = keyOf(routeName);
    if (!key) return;
    const focused = activeName === routeName;
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(routeName as never);
  };

  const half = Math.ceil(tabs.length / 2);
  const rightGroup = tabs.slice(0, half); // first = visual right in RTL
  const leftGroup = tabs.slice(half);

  const renderTab = (name: string) => {
    const focused = activeName === name;
    return (
      <TouchableOpacity
        key={name}
        onPress={() => go(name)}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 44 }}
      >
        <Icon name={icons[name] ?? 'home'} size={23} color={focused ? colors.brand : colors.faint} outline={!focused} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: focused ? colors.brand : colors.faint }} numberOfLines={1}>
          {labels[name] ?? name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'flex-start',
        paddingTop: spacing.sm,
        paddingBottom: 10 + insets.bottom,
        height: 64 + insets.bottom,
        backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.94)' : colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        ...shadows.glow,
      }}
    >
      {rightGroup.map(renderTab)}

      {/* Raised center FAB — the role's primary action */}
      <View style={{ width: 72, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => go(center.name)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={labels[center.name]}
          style={{ marginTop: -24, borderRadius: radius.xl, ...shadows.hero }}
        >
          <LinearGradient colors={gradients.brandCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 58, height: 58, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={center.icon} size={26} color="#fff" />
          </LinearGradient>
          {centerBadge && centerBadge > 0 ? (
            <View style={{ position: 'absolute', top: -26, left: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' }}>{centerBadge > 99 ? '99+' : centerBadge}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {leftGroup.map(renderTab)}
    </View>
  );
}
