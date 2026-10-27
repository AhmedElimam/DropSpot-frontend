import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { useThemeStore } from '@/stores/themeStore';
import { RoseStamp, type StampInk } from '@/components/rose/RoseStamp';
import type { SubscriptionSheet } from './receipt';

// The word on her stamp, in the stamp's own ink (the night inks are RoseStamp's).
const DAY_INK: Record<StampInk, string> = { green: '#167A4A', red: '#C0263A', navy: '#2C3A8C', violet: '#5B3FC4' };
const NIGHT_INK: Record<StampInk, string> = { green: '#7FD8A8', red: '#F2647A', navy: '#B9C4F4', violet: '#B4A6FF' };

/** The rubber-stamp word — «مدفوع», «معفى», «متأخّرة» — pressed at a tilt under her crest. */
export function StampWord({ ink, word, size = 20 }: { ink: StampInk; word: string; size?: number }) {
  const night = useThemeStore((s) => s.scheme) === 'dark';
  const c = (night ? NIGHT_INK : DAY_INK)[ink];
  return (
    <View style={{ transform: [{ rotate: '-10deg' }], borderWidth: 2.5, borderColor: c, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: 2, opacity: 0.9 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: size, lineHeight: size * 1.45, color: c, letterSpacing: 0.5 }}>{word}</Text>
    </View>
  );
}

/**
 * Her sheet: a paper card with the title and her stamp beside it — the crest (only while her
 * name is on, RoseStamp's rule) with the word pressed under it — then the facts in rows.
 */
export function SubscriptionSheetView({ sheet, animate = false, compact = false }: { sheet: SubscriptionSheet; animate?: boolean; compact?: boolean }) {
  const crest = compact ? 58 : 84;
  return (
    <View style={{ backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', padding: compact ? spacing.md : spacing.lg }}>
      {/* The title, and her stamp pressed beside it — never over a figure. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: compact ? spacing.xs : spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: compact ? 14 : 15.5, lineHeight: compact ? 21 : 24, color: colors.textPrimary }}>{sheet.title}</Text>
        <View pointerEvents="none" style={{ alignItems: 'center', marginVertical: -spacing.xs }}>
          <RoseStamp ink={sheet.ink} size={crest} animate={animate} tilt={-12} />
          <View style={{ marginTop: -crest * 0.22 }}>
            <StampWord ink={sheet.ink} word={sheet.word} size={compact ? 13 : 17} />
          </View>
        </View>
      </View>
      <View style={{ gap: compact ? 4 : 6, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: compact ? spacing.sm : spacing.md }}>
        {sheet.rows.map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: compact ? 13 : 14, color: colors.textSecondary }}>{r.label}</Text>
            <Text style={{ fontFamily: r.strong ? fonts.bold : fonts.medium, fontSize: compact ? 13 : 14, color: colors.textPrimary }} numberOfLines={1}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
