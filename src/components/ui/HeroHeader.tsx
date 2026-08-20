import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, gradients, layout } from '@/theme/index';
import { HeaderBrandBar } from './HeaderBrandBar';

/**
 * The deep-ink hero band every top-level screen opens with — brand bar (bell +
 * unread dot), a greeting/title, a date/subtitle, and an optional content slot
 * for a stat row. Extracted from the pattern hand-rolled across ~14 screens so
 * the padding, safe-area handling, and type ramp are identical everywhere.
 *
 * The screen still owns its ScrollView (each has different refetchers); it paints
 * its container `gradients.hero[0]` and pulls the body up with a negative margin,
 * exactly as before. Horizontal padding is `layout.screenPadding` — match it in
 * the body container so the pulled-up cards line up with the hero.
 */

interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  /** When set, renders the brand bar with a notifications bell. */
  onBell?: () => void;
  unread?: number;
  /** Title size — 26 for greetings, 28 for section titles (e.g. Invoices). */
  titleSize?: number;
  /** Content below the subtitle — typically a row of `<StatTile onHero />`. */
  children?: ReactNode;
}

export function HeroHeader({ title, subtitle, onBell, unread, titleSize = 26, children }: HeroHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl4 }}
    >
      {onBell ? <HeaderBrandBar onBell={onBell} unread={unread} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: titleSize, color: colors.white, letterSpacing: -0.5 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xs }}>
          {subtitle}
        </Text>
      ) : null}
      {children ? <View style={{ marginTop: spacing.xl }}>{children}</View> : null}
    </LinearGradient>
  );
}
