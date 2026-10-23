import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';

interface OtpInputProps {
  value: string;
  onChange: (digits: string) => void;
  /** Called once, the moment the last cell fills. */
  onComplete?: (digits: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
}

/**
 * A 6-cell code entry. One TextInput holds the digits and the cells only DISPLAY them.
 * The field lies over the cells at full size, with transparent text — not a 1 px dot — so
 * a long-press opens the system paste menu and iOS offers the code from the SMS above
 * the keyboard as it does for any ordinary field (founder 2026-10-10: neither worked).
 * Cells are laid out left-to-right explicitly: a code is a number, and the SMS shows it
 * that way, so the eye should match digit for digit even inside an RTL app.
 *
 * The cells FIT the width they are given (founder 2026-10-24: «on some devices it gets messy»):
 * six fixed 46-pt cells and their gaps needed 316 pt, more than a 360-dp Android or a 375-pt
 * iPhone has inside the auth card, so the outer cells spilled past it. Now the row measures
 * itself and each cell takes its share (at most 52 pt), and the digit is sized to the cell with
 * the system's text scaling off — a code digit that outgrows its box helps nobody.
 */
export function OtpInput({ value, onChange, onComplete, length = 6, error, autoFocus = true }: OtpInputProps) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const completedFor = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === length && completedFor.current !== value) {
      completedFor.current = value;
      onComplete?.(value);
    }
    if (value.length < length) completedFor.current = null;
  }, [value, length, onComplete]);

  const cells = Array.from({ length }, (_, i) => value[i] ?? '');
  const active = Math.min(value.length, length - 1);

  // Until the row has measured itself, assume the auth card's width (screen − 72).
  const win = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(240, win.width - 72));
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };
  const gap = width < 300 ? 6 : spacing.sm;
  const cell = Math.max(34, Math.min(52, Math.floor((width - gap * (length - 1)) / length)));
  const cellHeight = Math.round(cell * 1.2);
  const digit = Math.round(cell * 0.56);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityRole="none" accessibilityLabel="رمز التحقق" onLayout={onLayout} style={{ alignSelf: 'stretch' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap, direction: 'ltr' }}>
        {cells.map((d, i) => {
          const isActive = focused && i === active && value.length < length;
          const tone = error ? colors.danger : isActive ? colors.brand : d ? colors.textPrimary : colors.borderStrong;
          return (
            <View
              key={i}
              style={{
                width: cell,
                height: cellHeight,
                borderRadius: radius.md,
                borderWidth: isActive || error ? 2 : 1.5,
                borderColor: tone,
                backgroundColor: d ? colors.surface : colors.surfaceSunken,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text allowFontScaling={false} style={{ fontFamily: fonts.bold, fontSize: digit, lineHeight: Math.round(digit * 1.35), color: error ? colors.danger : colors.textPrimary, includeFontPadding: false, textAlignVertical: 'center' }}>{d}</Text>
              {isActive && !d ? <View style={{ position: 'absolute', width: 2, height: Math.round(cellHeight * 0.42), backgroundColor: colors.brand, borderRadius: 1 }} /> : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        // No maxLength: a pasted «123 456» or an AutoFill with a stray space is cleaned here.
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // The OS offers the code it just saw in the SMS above the keyboard.
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        autoCorrect={false}
        spellCheck={false}
        contextMenuHidden={false}
        caretHidden
        selectionColor="transparent"
        accessibilityLabel="رمز التحقق"
        // Over the cells, same size, invisible text: taps focus it, a long-press pastes.
        allowFontScaling={false}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, color: 'transparent', backgroundColor: 'transparent', fontSize: digit, textAlign: 'center' }}
      />
    </Pressable>
  );
}
