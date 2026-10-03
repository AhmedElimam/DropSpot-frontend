import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, radius, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Image } from 'expo-image';
import { GeneratedAvatar } from '@/components/ui/GeneratedAvatar';

export interface HeroStat {
  value: string;
  label: string;
  /** Draw the value in the accent colour (something needs attention). */
  warn?: boolean;
}

/**
 * The page header every student and parent screen shares (founder 2026-10-03: «more love on
 * the student and parent apps on all pages»). Compact on purpose: a back chip and an
 * optional action on the first row, the title and a calm line under it, and — when the page
 * has numbers worth a glance — up to three glass stat chips. Content below is expected to
 * overlap the hero's bottom padding (`marginTop: -spacing.xl4`) so the first card sits on
 * the seam, the way the home screens do.
 *
 * Draws through the hero tokens, so it is ink on paper by day and white on navy by night.
 */
export function PageHero({ title, subtitle, avatar, avatarUrl, onBack, action, stats, children, compact = false }: {
  title: string;
  subtitle?: string;
  /** The person's avatar seed (see `avatarSeed`) — drawn as their generated character. */
  avatar?: string;
  /** A photo or logo that wins over the generated character when present. */
  avatarUrl?: string | null;
  /** Show the back chip. Pass `true` to pop (falling back to the role home), or a handler. */
  onBack?: boolean | (() => void);
  /** A chip on the far side of the first row. */
  action?: { icon: IconName; label?: string; onPress: () => void; accessibilityLabel?: string; badge?: number };
  stats?: HeroStat[];
  children?: ReactNode;
  /** No overlap allowance at the bottom (the content starts flush under the hero). */
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const back = onBack === true ? () => (router.canGoBack() ? router.back() : router.replace('/resolve' as never)) : onBack || undefined;
  const hasRow = !!back || !!action;

  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, paddingBottom: compact ? spacing.lg : spacing.xl4 + spacing.lg }}
    >
      {hasRow ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          {back ? (
            <TouchableOpacity onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
              {/* RTL: "back" points to the right. */}
              <Icon name="forward" size={22} color={colors.onHero} />
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
          {action ? (
            <TouchableOpacity onPress={action.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? action.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, minWidth: 40, paddingHorizontal: action.label ? spacing.md : 0, justifyContent: 'center', borderRadius: 12, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
              <Icon name={action.icon} size={20} color={colors.onHero} outline />
              {action.label ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onHero }}>{action.label}</Text> : null}
              {action.badge ? (
                <View style={{ position: 'absolute', top: -5, end: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.onPrimary }}>{action.badge > 9 ? '9+' : action.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {avatarUrl ? (
          <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: colors.onHeroChipBorder }}>
            <Image source={{ uri: avatarUrl }} style={{ width: 60, height: 60, backgroundColor: colors.surface }} contentFit="cover" accessibilityLabel={title} />
          </View>
        ) : avatar ? (
          <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: colors.onHeroChipBorder }}>
            <GeneratedAvatar seed={avatar} size={60} square label={title} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: colors.onHero }} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.onHeroSoft, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
      </View>

      {stats && stats.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          {stats.slice(0, 3).map((x) => (
            <View key={x.label} style={{ flex: 1, backgroundColor: colors.onHeroChip, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.onHeroChipBorder, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: x.warn ? colors.accent : colors.onHero }} numberOfLines={1} adjustsFontSizeToFit>{x.value}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onHeroSoft }} numberOfLines={1}>{x.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {children}
    </LinearGradient>
  );
}
