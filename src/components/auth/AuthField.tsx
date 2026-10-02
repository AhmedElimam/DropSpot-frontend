import { forwardRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, control } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

export interface AuthFieldProps extends TextInputProps {
  label: string;
  /** Leading glyph at the START (right, in RTL) edge of the box. */
  icon?: IconName;
  /** Shown in red under the box; also paints the border. */
  error?: string | null;
  /** Calm helper line under the box, shown when there is no error. */
  hint?: string;
  /** Paints a green border + tick once the value is known-good (e.g. a full phone). */
  valid?: boolean;
  /** A password field: hidden text plus a show/hide eye at the END of the box. */
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * One labelled input for the auth screens: label above, a 56 px box with a leading
 * icon, a brand focus ring, and the validation line under it. The box reports its state
 * by colour alone in one place — focused (brand), wrong (danger), good (green), idle —
 * so every auth field looks and behaves the same, and parents in their fifties get a
 * big target, a big glyph size and a plain-language message under the exact field.
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, icon, error, hint, valid, secure, containerStyle, style, onFocus, onBlur, editable = true, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  // The eye is a plain row item, not an absolutely-positioned overlay (PasswordInput's
  // approach). Inside this flex row the overlay's wrapper had no width of its own, so the
  // eye landed on top of the typed text (founder 2026-10-02: "show password icon is
  // ruined on login"). As the row's last child it sits at the trailing edge in RTL and
  // the input simply ends before it — no padding guesswork.
  const [revealed, setRevealed] = useState(false);
  const tone = error ? colors.danger : focused ? colors.brand : valid ? colors.success : colors.borderStrong;

  return (
    <View style={[{ marginBottom: spacing.lg }, containerStyle]}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginBottom: 6, textAlign: 'right' }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: control.minHeight + 4,
          backgroundColor: editable ? colors.surface : colors.surfaceSunken,
          borderRadius: radius.lg,
          borderWidth: focused || error ? 2 : 1.5,
          borderColor: tone,
          paddingHorizontal: spacing.md,
          // The ring: a faint tint in the focus colour, iOS only (Android draws no shadows).
          shadowColor: tone,
          shadowOpacity: focused ? 0.18 : 0,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {icon ? <Icon name={icon} size={20} color={focused || error || valid ? tone : colors.textTertiary} outline style={{ marginEnd: spacing.sm }} /> : null}
        <TextInput
          ref={ref}
          {...input}
          secureTextEntry={secure ? !revealed : input.secureTextEntry}
          editable={editable}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          placeholderTextColor={colors.textTertiary}
          style={[
            {
              flex: 1,
              fontFamily: fonts.regular,
              fontSize: 17,
              color: colors.textPrimary,
              textAlign: 'right',
              paddingVertical: 14,
            },
            style,
          ]}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setRevealed((v) => !v)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            style={{ marginStart: spacing.sm, paddingVertical: 4, paddingHorizontal: 2 }}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={22} color={focused ? colors.brand : colors.textTertiary} outline />
          </TouchableOpacity>
        ) : null}
        {valid && !error && !secure ? <Icon name="success" size={20} color={colors.success} style={{ marginStart: spacing.sm }} /> : null}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icon name="error" size={15} color={colors.danger} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.danger, textAlign: 'right' }}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textTertiary, marginTop: 6, textAlign: 'right' }}>{hint}</Text>
      ) : null}
    </View>
  );
});
