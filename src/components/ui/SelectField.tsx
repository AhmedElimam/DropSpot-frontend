import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

export interface SelectOption {
  key: string;
  label: string;
}

/**
 * A dropdown: a field showing the current choice that expands the options beneath it.
 *
 * React Native has no cross-platform <select>, and a row of chips stops working the
 * moment the list is longer than the screen is wide. The options expand INLINE rather
 * than in a Modal on purpose: this field is used inside the teacher's compose Modal, and
 * a Modal opened from inside another Modal is unreliable on iOS — it opens behind the
 * sheet, or not at all, which reads as "the dropdown doesn't work". Inline has no such
 * failure mode and behaves identically on both platforms.
 */
export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
  emptyHint,
}: {
  label?: string;
  placeholder: string;
  value: string | null;
  options: SelectOption[];
  onChange: (key: string) => void;
  disabled?: boolean;
  /** Shown in place of the list when there is nothing to choose from. */
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  const isEmpty = options.length === 0;

  return (
    <View>
      {label ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xs }}>{label}</Text>
      ) : null}

      <TouchableOpacity
        onPress={() => !disabled && setOpen((v) => !v)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          backgroundColor: colors.background,
          borderRadius: radius.md,
          borderBottomLeftRadius: open ? 0 : radius.md,
          borderBottomRightRadius: open ? 0 : radius.md,
          borderWidth: 1,
          borderBottomWidth: open ? 0 : 1,
          borderColor: open || selected ? colors.primary : colors.border,
          paddingHorizontal: spacing.md, minHeight: 48,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1, fontFamily: selected ? fonts.medium : fonts.regular, fontSize: 15,
            lineHeight: 24, color: selected ? colors.textPrimary : colors.textTertiary,
          }}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Icon name={open ? 'up' : 'down'} size={16} color={open ? colors.primary : colors.textTertiary} />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            borderWidth: 1, borderTopWidth: 0, borderColor: colors.primary,
            borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
            backgroundColor: colors.surface, overflow: 'hidden', maxHeight: 260,
          }}
        >
          {isEmpty ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textTertiary, padding: spacing.md }}>
              {emptyHint ?? '—'}
            </Text>
          ) : (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {options.map((o, i) => {
                const active = o.key === value;
                return (
                  <TouchableOpacity
                    key={o.key}
                    onPress={() => { onChange(o.key); setOpen(false); }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                      backgroundColor: active ? colors.primaryLight : 'transparent',
                    }}
                  >
                    <Text style={{ flex: 1, fontFamily: active ? fonts.bold : fonts.regular, fontSize: 15, lineHeight: 24, color: active ? colors.primary : colors.textPrimary }}>
                      {o.label}
                    </Text>
                    {active ? <Icon name="success" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
