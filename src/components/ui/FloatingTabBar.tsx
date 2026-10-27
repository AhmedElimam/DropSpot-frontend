import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { showTabBar, useTabBarScroll } from '@/navigation/tabBarScroll';
import Svg, { Path } from 'react-native-svg';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BETA_GOLD } from '@/components/ui/betaTokens';
import { fonts } from '@/theme/typography';
import { colors, shadows, isDark, isRevisionTheme } from '@/theme/index';
import { usePreloadTabs } from '@/navigation/usePreloadTabs';
import { Icon, type IconName } from '@/components/ui/Icon';
import { TourTarget } from '@/tour/TourTarget';

/** The pill's own height; it floats `GAP` above the home indicator. Screens pad with `nav.bottomHeight`. */
export const PILL_HEIGHT = 62;
export const GAP = 10;
export const SIDE = 14;
/** How far the centre button rises above the pill's top edge. */
export const RAISE = 20;
/** Centre button diameter, and the notch cut around it (a 6pt breath on each side). */
export const BUTTON = 56;
export const NOTCH_R = BUTTON / 2 + 6;

/**
 * The floating pill's outline: a stadium (fully rounded ends) with a circular cut in the
 * middle of its top edge for the raised centre button. Pure, so the geometry is testable.
 * `width` is the pill's own width; the path is symmetric, so RTL needs nothing.
 */
export function floatingNotchPath(width: number, height: number): string {
  const r = height / 2;
  const cx = width / 2;
  const top = RAISE;
  // The notch is the lower arc of the circle around the button (centre at BUTTON / 2 from the
  // container's top), cut where that circle meets the pill's top edge.
  const cy = BUTTON / 2;
  const dy = top - cy;
  const half = Math.sqrt(NOTCH_R * NOTCH_R - dy * dy);
  const n = (v: number) => Math.round(v * 100) / 100;
  return [
    `M ${r} ${top}`,
    `L ${n(cx - half)} ${top}`,
    `A ${NOTCH_R} ${NOTCH_R} 0 1 0 ${n(cx + half)} ${top}`,
    `L ${width - r} ${top}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${top + height}`,
    `L ${r} ${top + height}`,
    `A ${r} ${r} 0 0 1 ${r} ${top}`,
    'Z',
  ].join(' ');
}

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

interface FloatingTabBarProps extends BottomTabBarProps {
  /** The visible tabs, first to last (first sits at the start edge: the right, in RTL). */
  tabs: readonly string[];
  /** The tab in the raised centre button — the role's most important screen. */
  center: string;
  /** i18n key per tab. */
  labels: Record<string, string>;
  icons: Record<string, IconName>;
  /** What sits in the centre button instead of its icon — the brand mark. */
  centerGlyph?: (color: string, focused: boolean) => ReactNode;
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
 * The floating tab bar every role uses (founder 2026-10-28: «like Facebook, floating» — and
 * «we want the logo and the cut back, floating style»): one pill lifted off the bottom edge
 * with the brand button raised out of a notch in its top and no word under it, every other
 * tab the same weight, the open one in the brand colour on a soft pill.
 *
 * Opaque on purpose (no blur: a translucent floating bar is continuous compositing work on
 * mid-range Android, and expo-blur is off the dependency list). Only `tabs` are drawn; every
 * other registered route (the detail screens) is left to navigation.
 */
export function FloatingTabBar({ state, descriptors, navigation, tabs, center, labels, icons, centerGlyph, badges, beta }: FloatingTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pillWidth = width - SIDE * 2;
  const dark = isDark();
  const season = isRevisionTheme();
  // The glyph on the centre button: white on the day indigo (and the season's), SILVER on the night navy.
  const onButton = dark && !season ? colors.logo : '#FFFFFF';
  // Build the other tabs in the background once launch settles: no blank first frame on a tab's first tap.
  usePreloadTabs(navigation as unknown as Parameters<typeof usePreloadTabs>[0], state, tabs);

  // Slides out of view on a scroll down, back on a scroll up (one short timing, nothing endless);
  // a tab change always brings it back.
  const hidden = useTabBarScroll((s) => s.hidden);
  const bottomPad = Math.max(insets.bottom, 8) + GAP;
  const slide = useSharedValue(0);
  useEffect(() => { slide.value = withTiming(hidden ? PILL_HEIGHT + RAISE + bottomPad + 6 : 0, { duration: 220 }); }, [hidden, bottomPad, slide]);
  useEffect(() => { showTabBar(); }, [state.index]);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));

  return (
    <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SIDE, paddingBottom: bottomPad }, slideStyle]}>
      <View style={{ height: PILL_HEIGHT + RAISE }}>
        {/* The pill is see-through: the page shows faintly behind it (no blur — expo-blur is off
            the dependency list and a blurred bar is continuous compositing work on mid-range
            Android). The shadow is cast from the path's own shape. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, ...shadows.lg }}>
          <Svg width={pillWidth} height={PILL_HEIGHT + RAISE}>
            <Path d={floatingNotchPath(pillWidth, PILL_HEIGHT)} fill={colors.tabBar} fillOpacity={0.88} />
            <Path d={floatingNotchPath(pillWidth, PILL_HEIGHT)} fill="none" stroke={dark ? 'rgba(255,255,255,0.12)' : colors.border} strokeWidth={1} />
          </Svg>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: RAISE, height: PILL_HEIGHT + RAISE, paddingHorizontal: 4 }}>
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
                  <TourTarget id={`tab:${name}`} style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: BUTTON,
                      height: BUTTON,
                      borderRadius: BUTTON / 2,
                      backgroundColor: colors.tabActive,
                      // By night the button is the emblem's own: deep navy, a silver rim that turns
                      // orange when the tab is open. «وضع المراجعة» takes the same treatment in both schemes.
                      ...(dark || season ? { backgroundColor: colors.logoButton, borderWidth: 2, borderColor: focused ? colors.tabActive : colors.logoRing } : null),
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: focused ? 1 : 0.92,
                      transform: [{ scale: focused ? 1 : 0.96 }],
                      ...shadows.md,
                    }}
                  >
                    {centerGlyph ? centerGlyph(onButton, focused) : <Icon name={icons[name] || 'home'} size={28} color={onButton} outline={!focused} />}
                    {badges?.[name] ? <TabBadge n={badges[name]} /> : null}
                  </View>
                  {/* No word under the brand button (founder 2026-10-28: «remove the text»); the
                      label stays on the tab for the screen reader. */}
                  </TourTarget>
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
                style={{ flex: 1, alignItems: 'center', paddingTop: 7 }}
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
    </Animated.View>
  );
}
