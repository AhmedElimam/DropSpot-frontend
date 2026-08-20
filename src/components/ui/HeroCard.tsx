import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon, type IconName } from './Icon';
import { toArabicDigits } from '@/utils/numerals';

/**
 * The single most important thing on a screen — one per screen. Brand-indigo
 * gradient, big radius, brand-tinted elevation, white text (spec 3.2). Composed
 * of optional parts: a status pill, a title + meta lines, a stat row, and a
 * primary/secondary action row.
 *
 * Student home: next session + "تسجيل الحضور" CTA. Teacher home: live session +
 * attendance counts + "مسح الحضور". Parent home: the selected child's status.
 */

interface HeroStat {
  value: string | number;
  label: string;
}

interface HeroAction {
  label: string;
  icon?: IconName;
  onPress: () => void;
}

interface HeroCardProps {
  /** Small pill at the top; `live` adds a pulsing-green dot (e.g. "جارية الآن"). */
  pill?: { label: string; live?: boolean };
  title: string;
  /** Muted white meta lines under the title (time, location, group…). */
  meta?: string[];
  /** Optional row of big-number stats (teacher attendance counts). */
  stats?: HeroStat[];
  /** White CTA — the screen's primary action. */
  primary?: HeroAction;
  /** Translucent secondary action shown beside the primary. */
  secondary?: HeroAction;
  /** Centred helper line under the actions (e.g. the check-in window rule). */
  footnote?: string;
  children?: ReactNode;
}

export function HeroCard({ pill, title, meta, stats, primary, secondary, footnote, children }: HeroCardProps) {
  return (
    <LinearGradient
      colors={gradients.brandCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.hero, padding: spacing.xl, ...shadows.hero, overflow: 'hidden' }}
    >
      {/* Soft decorative circle (spec .hero::after) */}
      <View pointerEvents="none" style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.07)', top: -100, left: -60 }} />
      {pill ? (
        <View style={{ flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
          {pill.live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} /> : null}
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{pill.label}</Text>
        </View>
      ) : null}

      <Text style={{ fontFamily: fonts.bold, fontSize: 21, lineHeight: 30, color: '#fff', letterSpacing: -0.3 }}>
        {title}
      </Text>

      {meta?.length ? (
        <View style={{ marginTop: spacing.xs, gap: 2 }}>
          {meta.map((line, i) => (
            <Text key={i} style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {stats?.length ? (
        <View style={{ flexDirection: 'row', marginTop: spacing.lg, gap: spacing.md }}>
          {stats.map((s, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }} numberOfLines={1} adjustsFontSizeToFit>
                {typeof s.value === 'number' ? toArabicDigits(s.value) : s.value}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2, textAlign: 'center' }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {children}

      {primary || secondary ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          {secondary ? (
            <TouchableOpacity
              onPress={secondary.onPress}
              activeOpacity={0.85}
              style={{ flex: 1, minHeight: 48, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.16)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}
            >
              {secondary.icon ? <Icon name={secondary.icon} size={18} color="#fff" /> : null}
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{secondary.label}</Text>
            </TouchableOpacity>
          ) : null}
          {primary ? (
            <TouchableOpacity
              onPress={primary.onPress}
              activeOpacity={0.9}
              style={{ flex: secondary ? 1.4 : 1, minHeight: 48, borderRadius: radius.sm, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}
            >
              {primary.icon ? <Icon name={primary.icon} size={18} color={colors.brand} /> : null}
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{primary.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {footnote ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: spacing.md }}>
          {footnote}
        </Text>
      ) : null}
    </LinearGradient>
  );
}
