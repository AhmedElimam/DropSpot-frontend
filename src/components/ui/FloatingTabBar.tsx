import type { ComponentProps } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BETA_GOLD } from '@/components/ui/betaTokens';
import { fonts } from '@/theme/typography';
import { colors, shadows, isDark } from '@/theme/index';
import { usePreloadTabs } from '@/navigation/usePreloadTabs';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TourTarget } from '@/tour/TourTarget';

/** The pill's own height; it floats `GAP` above the home indicator. Screens pad with `nav.bottomHeight`. */
export const PILL_HEIGHT = 62;
export const GAP = 10;
export const SIDE = 14;

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

interface FloatingTabBarProps extends BottomTabBarProps {
  /** The visible tabs, first to last (first sits at the start edge: the right, in RTL). */
  tabs: readonly string[];
  /** i18n key per tab. */
  labels: Record<string, string>;
  icons: Record<string, IconName>;
  /** Counts per tab; 0 / absent draws nothing. */
  badges?: Record<string, number>;
  /** Tabs that reached this person as a beta (feature targeting): a small gold dot, unless a count is showing. */
  beta?: readonly string[];
}

/** A small count on a tab's corner. Static — nothing animates in the bar. */
function TabBadge({ n }: { n: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -5, end: -9, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.tabBar, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, color: '#FFFFFF' }}>{n > 99 ? '+٩٩' : String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])}</Text>
    </View>
  );
}

/**
 * The floating tab bar every role uses (founder 2026-10-28: «change the app navbar style to be
 * like Facebook, floating»): one pill lifted off the bottom edge, every tab the same weight,
 * the open one in the brand colour on a soft pill. It replaced the notched bar with the raised
 * centre button.
 *
 * Opaque on purpose (no blur: a translucent floating bar is continuous compositing work on
 * mid-range Android, and expo-blur is off the dependency list). Only `tabs` are drawn; every
 * other registered route (the detail screens) is left to navigation.
 */
export function FloatingTabBar({ state, descriptors, navigation, tabs, labels, icons, badges, beta }: FloatingTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dark = isDark();
  // Build the other tabs in the background once launch settles: no blank first frame on a tab's first tap.
  usePreloadTabs(navigation as unknown as Parameters<typeof usePreloadTabs>[0], state, tabs);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SIDE, paddingBottom: Math.max(insets.bottom, 8) + GAP }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          paddingHorizontal: 6,
          backgroundColor: colors.tabBar,
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.10)' : colors.border,
          ...shadows.lg,
        }}
      >
        {tabs.map((name) => {
          const route = state.routes.find((r) => r.name === name);
          if (!route) return <View key={name} style={{ flex: 1 }} />;
          const focused = state.routes[state.index]?.key === route.key;
          const label = labels[name] ? t(labels[name]) : (descriptors[route.key]?.options.title ?? name);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={name}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: PILL_HEIGHT }}
            >
              <TourTarget id={`tab:${name}`} style={{ alignItems: 'center' }}>
                <View style={{ width: 46, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.brandTint : 'transparent' }}>
                  <Icon name={icons[name] || 'home'} size={23} color={focused ? colors.tabActive : colors.tabInactive} outline={!focused} />
                  {badges?.[name] ? <TabBadge n={badges[name]} /> : null}
                  {!badges?.[name] && beta?.includes(name) ? (
                    <View testID={`tab-beta:${name}`} accessibilityLabel={t('beta.chip_a11y')} style={{ position: 'absolute', top: -1, end: 4, width: 9, height: 9, borderRadius: 5, backgroundColor: BETA_GOLD, borderWidth: 1.5, borderColor: colors.tabBar }} />
                  ) : null}
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: focused ? fonts.bold : fonts.medium, fontSize: 10.5, lineHeight: 14, color: focused ? colors.tabActive : colors.tabInactive, marginTop: 1, paddingHorizontal: 2 }}>
                  {label}
                </Text>
              </TourTarget>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
