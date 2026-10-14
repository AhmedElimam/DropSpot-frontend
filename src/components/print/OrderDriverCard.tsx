import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import type { TrackInfo } from '@/api/print';

/** A thin upright bar between two facts — a middle dot beside a digit reads as «٠». */
export function OrderBar({ color = colors.border }: { color?: string }) {
  return <View style={{ width: 1, height: 12, backgroundColor: color }} />;
}

/**
 * The trip card that sits on the map's lower edge: who is bringing the prints, how far they
 * are, a call button, and the hand-over code big enough to read out at the door.
 */
export function OrderDriverCard({ track, showCode, overlap }: {
  track: TrackInfo;
  /** The hand-over code still matters (the job is not delivered yet). */
  showCode: boolean;
  /** Sits over the map's bottom edge. */
  overlap: boolean;
}) {
  const { t } = useTranslation();
  const d = track.delivery;
  const driver = d?.driver ?? null;
  const code = showCode ? track.handover_code : null;
  if (!d && !code) return null;

  const live = d?.is_active ?? false;
  const status = d
    ? d.eta_min ? t('print.track_eta', { m: formatNumber(d.eta_min) })
      : d.status === 'arrived' ? t('print.track_arrived')
      : driver?.online ? t('print.track_online') : t('print.track_offline')
    : null;
  const km = d?.remaining_km != null && live ? t('print.km_away', { km: formatNumber(d.remaining_km, { maximumFractionDigits: 1 }) }) : null;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
      marginHorizontal: overlap ? spacing.md : 0, marginTop: overlap ? -44 : 0, marginBottom: spacing.md, ...shadows.lg }}>
      {driver ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.onAccent }}>{(driver.name || '').trim().charAt(0) || '؟'}</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 0, end: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.surface,
              backgroundColor: driver.online ? colors.success : colors.textTertiary }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }} numberOfLines={1}>{driver.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <Icon name="delivery" size={13} color={colors.textTertiary} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{driver.vehicle_label}</Text>
            </View>
            {status ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: live ? colors.successText : colors.textSecondary }}>{status}</Text>
                {km ? <><OrderBar /><Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{km}</Text></> : null}
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${driver.phone}`)} accessibilityRole="button" accessibilityLabel={t('print.call')}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="call" size={21} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      ) : d ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="delivery" size={20} color={colors.accentText} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{d.label}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="storefront" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('print.track_pickup_title')}</Text>
            {track.shop.address ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={2}>{track.shop.address}</Text> : null}
          </View>
        </View>
      )}

      {d?.fail_reason ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md }}>
          <Icon name="warning" size={17} color={colors.dangerText} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.dangerText }}>{d.fail_reason}</Text>
        </View>
      ) : null}

      {code ? (
        <View style={{ marginTop: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.brand, backgroundColor: colors.brandTint, paddingVertical: spacing.md, paddingHorizontal: spacing.md, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand, textAlign: 'center' }}>
            {t(track.mode === 'deliver' ? 'print.code_deliver' : 'print.code_pickup')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, direction: 'ltr' }}>
            {code.split('').map((c, i) => (
              <View key={i} style={{ width: code.length > 4 ? 40 : 50, height: 58, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: colors.textPrimary }}>{c}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
            {track.mode === 'deliver' ? t('print.order_code_ask') + ' ' : ''}{t('print.code_note')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
