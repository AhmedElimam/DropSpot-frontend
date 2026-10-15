import { memo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { TFunction } from 'i18next';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';
import { formatNumber } from '@/utils/format';
import { daysForm, type CreditTone } from '@/api/print';

/**
 * Small shared pieces of «سجل الدفع» (the teacher's payment record on the print market): the
 * tone's colours, the score ring, and the Arabic counts for days and jobs. Used by the record's
 * own screen, its card on the print tab, the composer and the order page.
 */

/** A tone on a light surface: a soft fill and its text colour. */
export function creditTint(tone: CreditTone): { bg: string; fg: string; solid: string } {
  switch (tone) {
    case 'ok': return { bg: colors.successLight, fg: colors.successText, solid: colors.success };
    case 'warn': return { bg: colors.warningLight, fg: colors.warningText, solid: colors.warning };
    case 'bad': return { bg: colors.dangerLight, fg: colors.dangerText, solid: colors.danger };
    default: return { bg: colors.infoLight, fg: colors.infoText, solid: colors.info };
  }
}

/** The ring's arc on the deep-ink hero, where the light-surface colours would be too dark. */
export function creditArc(tone: CreditTone): string {
  switch (tone) {
    case 'ok': return colors.success;
    case 'warn': return colors.warning;
    case 'bad': return colors.danger;
    default: return colors.accent;
  }
}

export const egpAmount = (v: number) => formatNumber(v, { maximumFractionDigits: v % 1 ? 2 : 0 });

/** «يوم / يومين / ٣ أيام / ١١ يوم». */
export function daysText(t: TFunction, n: number): string {
  const f = daysForm(n);
  return f === '0' || f === '1' ? t('print.credit_days_1') : f === '2' ? t('print.credit_days_2') : t(`print.credit_days_${f}`, { n: formatNumber(Math.round(n)) });
}

/** «طلب واحد / طلبين / ٣ طلبات / ١١ طلب». */
export function jobsText(t: TFunction, n: number): string {
  const f = daysForm(n);
  return f === '0' || f === '1' ? t('print.credit_jobs_1') : f === '2' ? t('print.credit_jobs_2') : t(`print.credit_jobs_${f}`, { n: formatNumber(Math.round(n)) });
}

/** «تدفع خلال ٣ أيام من الاستلام» (or «يوم الاستلام» with no grace). */
export function graceText(t: TFunction, days: number): string {
  return daysForm(days) === '0' ? t('print.credit_grace_0') : t('print.credit_grace', { days: daysText(t, days) });
}

/**
 * The score as a ring: the figure big in the middle, «من ١٠٠» under it. `onInk` draws it for
 * the deep hero (a faint white track, white figures); otherwise for a light card.
 */
export const CreditRing = memo(function CreditRing({ score, tone, size = 132, stroke = 12, onInk = false, caption }: {
  score: number; tone: CreditTone; size?: number; stroke?: number; onInk?: boolean; caption?: string | null;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = onInk ? creditArc(tone) : creditTint(tone).solid;
  const track = onInk ? 'rgba(255,255,255,0.16)' : colors.borderLight;
  const fg = onInk ? '#FFFFFF' : colors.textPrimary;
  const soft = onInk ? 'rgba(255,255,255,0.72)' : colors.textTertiary;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ now: pct, min: 0, max: 100 }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={arc} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" />
        ) : null}
      </Svg>
      {/* Arabic-Indic digits ride high: a loose line height keeps them from clipping. */}
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.3, lineHeight: size * 0.42, color: fg, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>{formatNumber(pct)}</Text>
      {caption ? <Text style={{ fontFamily: fonts.medium, fontSize: Math.max(10, size * 0.085), lineHeight: Math.max(13, size * 0.12), color: soft }} numberOfLines={1}>{caption}</Text> : null}
    </View>
  );
});
