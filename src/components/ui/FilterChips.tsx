import { memo } from 'react';
import { ScrollView, TouchableOpacity, Text, View } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

export type ChipOption<K extends string | number> = { key: K; label: string };

/**
 * One row of filter chips — the same look on every screen that filters a list.
 *
 * - Every chip is the same height, never shrinks and never wraps its label (RTL used to
 *   measure an Arabic label narrow, wrap it and clip the second line inside the chip), and
 *   a long course name is capped with an ellipsis instead of stretching the chip.
 * - Tapping the chip that is already selected does nothing: re-picking a filter must not
 *   refetch or reset what's on screen.
 * - `solid` (the default) fills the selected chip; `soft` tints it, for a second row that
 *   narrows the first (the venue under the period on insights).
 */
function FilterChipsInner<K extends string | number>({
  options, value, onChange, tone = 'solid', icon, disabled,
}: {
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
  tone?: 'solid' | 'soft';
  /** A small leading icon naming what this row filters by (e.g. a pin for venues). */
  icon?: IconName;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm, alignItems: 'center' }}
    >
      {icon ? (
        <View style={{ width: 28, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={colors.textTertiary} />
        </View>
      ) : null}
      {options.map((o) => {
        const on = o.key === value;
        const solid = tone === 'solid';
        return (
          <TouchableOpacity
            key={String(o.key)}
            onPress={() => { if (!on) onChange(o.key); }}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            style={{
              flexShrink: 0,
              height: 36,
              maxWidth: 220,
              paddingHorizontal: spacing.md,
              justifyContent: 'center',
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: on ? colors.brand : colors.border,
              backgroundColor: on ? (solid ? colors.brand : colors.brandTint) : colors.surface,
            }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: on ? (solid ? '#FFFFFF' : colors.brand) : colors.textSecondary }}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export const FilterChips = memo(FilterChipsInner) as typeof FilterChipsInner;
