import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber, formatTime } from '@/utils/format';
import { PRINT_FLOW, type PrintJob, type PrintStatus } from '@/api/print';

/** Each step of the walk, with its picture and the moment it happened. */
const STEP: Record<PrintStatus, { icon: IconName; at: keyof PrintJob } | undefined> = {
  sent: { icon: 'send', at: 'sent_at' },
  accepted: { icon: 'storefront', at: 'accepted_at' },
  printing: { icon: 'print', at: 'printing_at' },
  ready: { icon: 'document', at: 'ready_at' },
  delivered: { icon: 'delivery', at: 'delivered_at' },
  received: { icon: 'success', at: 'received_at' },
  declined: undefined,
  cancelled: undefined,
};

/** The hero's fill: the job's tone, orange while a driver is on the road. */
function heroFill(j: PrintJob, onRoad: boolean): readonly [string, string] {
  if (onRoad) return gradients.accent;
  switch (j.status_tone) {
    case 'success': return gradients.success;
    case 'danger': return [colors.danger, colors.dangerDark] as const;
    case 'warning': return gradients.warm;
    case 'gray': return [colors.primaryDark, colors.brandDeep] as const;
    default: return gradients.primary;
  }
}

/**
 * The order page's head (founder 2026-10-14: «some love on print order page»): what is
 * happening now in big letters, one line on when, and the walk as a row of icons — done
 * steps filled, the current one lit, the rest faint — like a delivery app's order tracker.
 */
export function OrderHero({ j, title, line, onRoad }: {
  j: PrintJob;
  /** The big status (the trip's label while a driver carries the job, else the job's). */
  title: string;
  /** ETA / due / hint under it. */
  line?: string | null;
  onRoad: boolean;
}) {
  const { t } = useTranslation();
  const idx = PRINT_FLOW.indexOf(j.status);
  const stopped = j.status === 'declined' || j.status === 'cancelled';
  const fg = colors.onPrimary;
  const icon: IconName = stopped ? 'close' : onRoad ? 'delivery' : STEP[j.status]?.icon ?? 'print';

  return (
    <LinearGradient colors={heroFill(j, onRoad)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', ...shadows.md }}>
      {/* A soft disc in the corner — depth without a picture. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, end: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: fg, opacity: 0.08 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -70, start: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: fg, opacity: 0.06 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: 18, backgroundColor: fg, opacity: 0.18 }} />
          <Icon name={icon} size={26} color={fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: fg, opacity: 0.8 }} numberOfLines={1}>
            {t('print.order_number', { n: formatNumber(j.id, { useGrouping: false }) })}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: fg }} numberOfLines={2}>{title}</Text>
        </View>
      </View>
      {line ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
          <Icon name={onRoad ? 'clock' : stopped ? 'info' : 'clock'} size={15} color={fg} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: fg, opacity: 0.92 }}>{line}</Text>
        </View>
      ) : null}

      {/* The walk */}
      <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
        {PRINT_FLOW.map((s, i) => {
          const done = !stopped && i < idx;
          const now = !stopped && i === idx;
          const step = STEP[s];
          const at = step ? (j[step.at] as string | null) : null;
          const size = now ? 38 : 30;
          return (
            <View key={s} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: '100%', height: 38, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: fg, opacity: i === 0 ? 0 : done || now ? 0.9 : 0.22 }} />
                <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: size / 2, backgroundColor: fg, opacity: done || now ? 1 : 0.2 }} />
                  {now ? <View style={{ position: 'absolute', top: -4, bottom: -4, start: -4, end: -4, borderRadius: size / 2 + 4, borderWidth: 2, borderColor: fg, opacity: 0.45 }} /> : null}
                  <Icon name={step?.icon ?? 'print'} size={now ? 19 : 15}
                    color={done ? colors.success : now ? colors.accent : fg} />
                </View>
                <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: fg, opacity: i === PRINT_FLOW.length - 1 ? 0 : done ? 0.9 : 0.22 }} />
              </View>
              <Text style={{ fontFamily: now ? fonts.bold : fonts.medium, fontSize: 10.5, color: fg, opacity: done || now ? 1 : 0.65, marginTop: 4 }} numberOfLines={1}>
                {t(`print.step_${s}`)}
              </Text>
              {at && (done || now) ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 9.5, color: fg, opacity: 0.75 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {formatTime(at)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </LinearGradient>
  );
}
