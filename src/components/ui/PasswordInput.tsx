import { forwardRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, type TextInputProps } from 'react-native';
import { Icon } from './Icon';
import { colors, spacing } from '@/theme/index';

/**
 * Password field with a show/hide eye toggle. Drop-in replacement for a bare
 * `<TextInput secureTextEntry />`: pass the same `style` (the screen's `field`) and
 * the same props. The component owns the reveal state and forces `secureTextEntry`
 * off only while the eye is toggled on. Each instance is independent, so a screen
 * with several password fields (current / new / confirm) gets one toggle each.
 *
 * RTL: text is right-aligned, so the eye sits at the trailing (LEFT) edge, and the
 * input reserves left padding so a long password never runs under the icon.
 */
export const PasswordInput = forwardRef<TextInput, TextInputProps>(
  function PasswordInput({ style, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          ref={ref}
          {...props}
          secureTextEntry={!visible}
          style={[style, { paddingLeft: 46 }]}
        />
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          style={{
            position: 'absolute',
            left: spacing.sm,
            // Span the field's full height and centre, then lift a few px: the input's
            // text sits optically above the box centre (Android especially), so a pure
            // centre reads slightly low against the glyphs.
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            paddingHorizontal: 6,
            transform: [{ translateY: -3 }],
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={22} color={colors.textTertiary} outline />
        </TouchableOpacity>
      </View>
    );
  },
);
