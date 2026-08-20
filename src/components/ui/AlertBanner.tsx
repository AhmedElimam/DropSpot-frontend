import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon, type IconName } from './Icon';

/**
 * A one-line-plus message banner for inline state — "no answer yet", "phone
 * unverified", "payment received". Not for full-screen empty/error states
 * (use EmptyState / ErrorState). Apricot (`accent`) is reserved for `warn`
 * only, per the design rule; info/success/danger use their semantic tints.
 */

export type AlertVariant = 'info' | 'warn' | 'success' | 'danger';

interface AlertBannerProps {
  variant?: AlertVariant;
  title: string;
  message?: string;
  /** Overrides the variant's default icon. */
  icon?: IconName;
  /** A trailing text button (e.g. "اتصل الآن"). */
  action?: { label: string; onPress: () => void };
  /** When set, shows a dismiss "×" that calls this. */
  onDismiss?: () => void;
}

const variantStyle: Record<AlertVariant, { bg: string; border: string; fg: string; icon: IconName }> = {
  info: { bg: colors.brandTint, border: colors.primaryLight, fg: colors.infoText, icon: 'info' },
  warn: { bg: colors.accentWarmTint, border: colors.accentLight, fg: colors.onAccent, icon: 'warning' },
  success: { bg: colors.successLight, border: colors.successLight, fg: colors.successText, icon: 'success' },
  danger: { bg: colors.dangerLight, border: colors.dangerLight, fg: colors.dangerText, icon: 'error' },
};

export function AlertBanner({ variant = 'info', title, message, icon, action, onDismiss }: AlertBannerProps) {
  const v = variantStyle[variant];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: v.bg,
        borderWidth: 1,
        borderColor: v.border,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
    >
      <Icon name={icon ?? v.icon} size={20} color={v.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: v.fg }}>{title}</Text>
        {message ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: v.fg, marginTop: 2, opacity: 0.9 }}>
            {message}
          </Text>
        ) : null}
        {action ? (
          <TouchableOpacity onPress={action.onPress} style={{ marginTop: spacing.sm }} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: v.fg, textDecorationLine: 'underline' }}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: v.fg, opacity: 0.7 }}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
