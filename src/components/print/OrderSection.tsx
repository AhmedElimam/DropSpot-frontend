import type { ReactNode } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * One card of the order page below the trip: a tinted icon tile, a title (and an optional
 * hint), an optional thing at the end — the same head on the spec, the receipt, the payment
 * and the rating, so the page reads as one order and not a stack of forms.
 */
export function OrderSection({ icon, title, hint, tint, end, clip, style, children }: {
  icon: IconName;
  title: string;
  hint?: string | null;
  tint: { bg: string; fg: string };
  end?: ReactNode;
  /** Clip to the rounded edge (the receipt's notches and full-bleed bands). */
  clip?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, overflow: clip ? 'hidden' : 'visible' }, style]}>
      <View style={{ flexDirection: 'row', alignItems: hint ? 'flex-start' : 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={19} color={tint.fg} />
        </View>
        <View style={{ flex: 1, minHeight: 36, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }} numberOfLines={1}>{title}</Text>
          {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: 1 }}>{hint}</Text> : null}
        </View>
        {end}
      </View>
      {children}
    </View>
  );
}

/** A small rounded label with an optional icon — rush, extras, the course. */
export function OrderChip({ text, icon, tone = 'plain' }: { text: string; icon?: IconName; tone?: 'plain' | 'accent' | 'brand' }) {
  const bg = tone === 'accent' ? colors.accentLight : tone === 'brand' ? colors.brandTint : colors.surfaceSunken;
  const fg = tone === 'accent' ? colors.accentText : tone === 'brand' ? colors.brand : colors.textSecondary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 30, maxWidth: '100%', borderRadius: radius.full, backgroundColor: bg, borderWidth: tone === 'plain' ? 1 : 0, borderColor: colors.borderLight }}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 12, color: fg }} numberOfLines={1}>{text}</Text>
    </View>
  );
}
