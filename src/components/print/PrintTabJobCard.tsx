import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ShopLogo } from '@/components/print/ShopLogo';
import { formatNumber, formatDateTime } from '@/utils/format';
import type { PrintJob, PrintStatus } from '@/api/print';

/** The walk an open job takes, each step with its picture. */
const WALK: { s: PrintStatus; icon: IconName }[] = [
  { s: 'sent', icon: 'send' },
  { s: 'accepted', icon: 'storefront' },
  { s: 'printing', icon: 'print' },
  { s: 'ready', icon: 'document' },
  { s: 'delivered', icon: 'delivery' },
];

/** The job's tone as a soft pill. */
export function toneTint(tone: PrintJob['status_tone']): { bg: string; fg: string } {
  switch (tone) {
    case 'success': return { bg: colors.successLight, fg: colors.successText };
    case 'warning': return { bg: colors.warningLight, fg: colors.warningText };
    case 'danger': return { bg: colors.dangerLight, fg: colors.dangerText };
    case 'gray': return { bg: colors.surfaceSunken, fg: colors.textSecondary };
    default: return { bg: colors.brandTint, fg: colors.brand };
  }
}

/**
 * A job on its way, the way a delivery app shows a live order: the shop's face, what it is,
 * where it stands (orange while a driver carries it), the driver and the minutes, and the
 * walk as a row of icons. Tap → the order page with the live map.
 */
export function PrintTabJobCard({ j }: { j: PrintJob }) {
  const { t } = useTranslation();
  const d = j.delivery;
  const moving = !!d?.is_active;
  const at = Math.max(0, WALK.findIndex((w) => w.s === j.status));
  const lit = moving ? colors.accent : colors.brand;
  const pill = moving ? { bg: colors.accentLight, fg: colors.accentText } : toneTint(j.status_tone);
  const when = moving && d?.eta_min ? t('print.track_eta', { m: formatNumber(d.eta_min) })
    : !moving && j.due_at && j.status !== 'ready' ? t('print.eta', { at: formatDateTime(j.due_at) }) : null;

  return (
    <TouchableOpacity onPress={() => router.push(`/(teacher)/print/${j.id}` as Href)} activeOpacity={0.9} accessibilityRole="button"
      style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: moving ? 1.5 : 1, borderColor: moving ? colors.accent : colors.border, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View>
          <ShopLogo logo={j.shop.logo} size={50} />
          {/* what is happening now, as a badge on the logo's corner */}
          <View style={{ position: 'absolute', bottom: -4, end: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: lit, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={moving ? 'delivery' : WALK[at].icon} size={12} color={colors.onPrimary} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }} numberOfLines={1}>{j.title}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textTertiary }} numberOfLines={1}>{j.shop.name ?? ''}</Text>
        </View>
        <Icon name="back" size={16} color={colors.textTertiary} />
      </View>

      {/* status, then the minutes */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: pill.bg }}>
          <Icon name={moving ? 'gps' : WALK[at].icon} size={13} color={pill.fg} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: pill.fg }} numberOfLines={1}>{moving ? d!.label : j.status_label}</Text>
        </View>
        {when ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
            <Icon name="clock" size={13} color={moving ? colors.accentText : colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: moving ? colors.accentText : colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>{when}</Text>
          </View>
        ) : null}
      </View>

      {d?.driver ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 10 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: moving ? colors.accentLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="delivery" size={14} color={moving ? colors.accentText : colors.brand} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }} numberOfLines={1}>{t('print.tab_driver', { name: d.driver })}</Text>
          {!moving ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }} numberOfLines={1}>{d.label}</Text> : null}
        </View>
      ) : null}

      {/* the walk */}
      <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
        {WALK.map((w, i) => {
          const done = i < at;
          const now = i === at;
          const size = now ? 26 : 20;
          return (
            <View key={w.s} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: '100%', height: 26, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: i === 0 ? 'transparent' : done || now ? lit : colors.borderLight }} />
                <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: done || now ? lit : colors.surfaceSunken, borderWidth: done || now ? 0 : 1, borderColor: colors.border }}>
                  <Icon name={w.icon} size={now ? 14 : 11} color={done || now ? colors.onPrimary : colors.textTertiary} />
                </View>
                <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: i === WALK.length - 1 ? 'transparent' : done ? lit : colors.borderLight }} />
              </View>
              <Text style={{ fontFamily: now ? fonts.bold : fonts.medium, fontSize: 10, marginTop: 3, color: now ? (moving ? colors.accentText : colors.brand) : done ? colors.textSecondary : colors.textTertiary }} numberOfLines={1}>
                {t(`print.step_${w.s}`)}
              </Text>
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}
