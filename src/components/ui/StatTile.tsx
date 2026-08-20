import { View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon, type IconName } from './Icon';
import { toArabicDigits } from '@/utils/numerals';

/**
 * A single headline number with its label — the unit the redesign's hero stat
 * rows and dashboard grids are built from. Two surfaces:
 *  - default: a bordered card on the paper canvas.
 *  - `onHero`: a translucent tile that sits on the deep-ink hero band.
 * An optional `progress` (0..1) draws a thin bar in the tone colour.
 *
 * Numbers passed as `number` are rendered Arabic-Indic; pass a pre-formatted
 * string (e.g. an EGP amount) to control formatting yourself.
 */

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: IconName;
  /** 0..1 — draws a progress bar under the value when provided. */
  progress?: number;
  tone?: Tone;
  onHero?: boolean;
}

const toneColor: Record<Tone, string> = {
  brand: colors.brand,
  success: colors.success,
  warning: colors.accent,
  danger: colors.danger,
  neutral: colors.inkSoft,
};

export function StatTile({ label, value, icon, progress, tone = 'brand', onHero = false }: StatTileProps) {
  const accent = toneColor[tone];
  const display = typeof value === 'number' ? toArabicDigits(value) : value;

  const valueColor = onHero ? '#fff' : colors.textPrimary;
  const labelColor = onHero ? 'rgba(255,255,255,0.72)' : colors.textSecondary;
  const iconColor = onHero ? '#fff' : accent;
  const trackColor = onHero ? 'rgba(255,255,255,0.20)' : colors.borderLight;
  const barColor = onHero ? '#fff' : accent;

  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        alignItems: 'center',
        backgroundColor: onHero ? 'rgba(255,255,255,0.12)' : colors.surface,
        borderWidth: 1,
        borderColor: onHero ? 'rgba(255,255,255,0.16)' : colors.border,
      }}
    >
      {icon ? (
        <Icon name={icon} size={18} color={iconColor} style={{ marginBottom: spacing.xs }} />
      ) : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: valueColor }} numberOfLines={1} adjustsFontSizeToFit>
        {display}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: labelColor, marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
        {label}
      </Text>
      {progress !== undefined ? (
        <View style={{ width: '100%', height: 4, borderRadius: radius.full, backgroundColor: trackColor, marginTop: spacing.sm, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`, height: '100%', borderRadius: radius.full, backgroundColor: barColor }} />
        </View>
      ) : null}
    </View>
  );
}
