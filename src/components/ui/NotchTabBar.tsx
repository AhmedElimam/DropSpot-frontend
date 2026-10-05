import type { ComponentProps, ReactNode } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, shadows, isDark } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/** The bar's own height, without the home indicator. Screens pad with `nav.bottomHeight`. */
export const BAR_HEIGHT = 64;
/** How far the centre button rises above the bar's top edge (founder 2026-10-03: «just down a little»). */
export const RAISE = 22;
/** Centre button diameter, and the notch cut around it (a 6pt breath on each side). */
export const BUTTON = 56;
export const NOTCH_R = BUTTON / 2 + 6;
const CORNER = 24;

/**
 * The bar's outline: rounded top corners and a circular cut in the middle for the raised
 * button. Pure, so the geometry is testable. `width` is the screen width; the path is
 * symmetric, so RTL needs nothing.
 */
export function notchPath(width: number, height: number): string {
  const cx = width / 2;
  const top = RAISE;
  // The notch is the lower arc of the circle around the button (centre at BUTTON / 2),
  // cut where that circle meets the bar's top edge.
  const cy = BUTTON / 2;
  const dy = top - cy;
  const half = Math.sqrt(NOTCH_R * NOTCH_R - dy * dy);
  const r = (n: number) => Math.round(n * 100) / 100;
  return [
    `M 0 ${top + CORNER}`,
    `Q 0 ${top} ${CORNER} ${top}`,
    `L ${r(cx - half)} ${top}`,
    `A ${NOTCH_R} ${NOTCH_R} 0 1 0 ${r(cx + half)} ${top}`,
    `L ${width - CORNER} ${top}`,
    `Q ${width} ${top} ${width} ${top + CORNER}`,
    `L ${width} ${top + height}`,
    `L 0 ${top + height}`,
    'Z',
  ].join(' ');
}

// What expo-router hands a custom `tabBar` — taken from Tabs itself, so the type follows
// whatever navigation version the router ships with.
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

interface NotchTabBarProps extends BottomTabBarProps {
  /** The visible tabs, first to last (first sits at the start edge: the right, in RTL). */
  tabs: readonly string[];
  /** The tab in the raised centre button — the role's most important screen. */
  center: string;
  /** i18n key per tab. */
  labels: Record<string, string>;
  icons: Record<string, IconName>;
  /** What sits in the centre button instead of its icon — the teacher's bar puts the brand mark there. */
  centerGlyph?: (color: string, focused: boolean) => ReactNode;
}

/**
 * The teacher's and the parent's tab bar (founder 2026-10-03: «highlight with a cut design
 * on the middle nav for the most important tab»). Same opaque, tokenised bar as before, with
 * the middle tab lifted into a round button that sits in a notch cut out of the bar. The
 * student bar is untouched and keeps the stock one.
 *
 * Only `tabs` are drawn; every other registered route (the detail screens with href: null)
 * is left to navigation. Opaque on purpose, like the bar it replaces: a translucent
 * floating bar is continuous compositing work on mid-range Android.
 */
export function NotchTabBar({ state, descriptors, navigation, tabs, center, labels, icons, centerGlyph }: NotchTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const height = BAR_HEIGHT + insets.bottom;
  const dark = isDark();
  // The glyph on the centre button: white on the day indigo, SILVER on the night navy.
  const onButton = dark ? colors.logo : '#FFFFFF';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: height + RAISE }}>
      <Svg width={width} height={height + RAISE} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <Path d={notchPath(width, height)} fill={colors.tabBar} />
        <Path d={notchPath(width, height)} fill="none" stroke={colors.border} strokeWidth={1} />
      </Svg>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: RAISE, height: height + RAISE }}>
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

          if (name === center) {
            return (
              <Pressable
                key={name}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                style={{ flex: 1, alignItems: 'center', marginTop: -RAISE }}
              >
                <View
                  style={{
                    width: BUTTON,
                    height: BUTTON,
                    borderRadius: BUTTON / 2,
                    backgroundColor: colors.tabActive,
                    // By night the button is the emblem's own: deep navy, a silver rim that turns
                    // orange when the tab is open (silver on the orange fill would not read).
                    ...(dark ? { backgroundColor: colors.logoButton, borderWidth: 2, borderColor: focused ? colors.tabActive : colors.logoRing } : null),
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: focused ? 1 : 0.92,
                    transform: [{ scale: focused ? 1 : 0.96 }],
                    ...shadows.md,
                  }}
                >
                  {centerGlyph ? centerGlyph(onButton, focused) : <Icon name={icons[name] || 'home'} size={28} color={onButton} outline={!focused} />}
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.bold, fontSize: 12, color: focused ? colors.tabActive : colors.tabInactive, marginTop: 4, paddingHorizontal: 2 }}>
                  {label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={name}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={{ flex: 1, alignItems: 'center', paddingTop: 8 }}
            >
              <View style={{ opacity: focused ? 1 : 0.55, transform: [{ scale: focused ? 1.08 : 1 }] }}>
                <Icon name={icons[name] || 'home'} size={24} color={focused ? colors.tabActive : colors.tabInactive} outline={!focused} />
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.medium, fontSize: 12, color: focused ? colors.tabActive : colors.tabInactive, marginTop: 2, paddingHorizontal: 2 }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
