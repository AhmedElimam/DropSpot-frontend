import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { useMyLocation, type MyPoint } from '@/components/LiveMap';
import { formatNumber, formatTime } from '@/utils/format';
import type { TeacherShare } from '@/api/print';
import { readLiveShare, sendStaticLocation, startLiveShare, stopLiveShare, type LiveShare, type ShareResult } from '@/background/shareLocation';

export type ShareMode = 'off' | 'static' | 'live' | 'live_other';
export const SHARE_LENGTHS = [15, 60, 480] as const;

/**
 * Where you are, for the driver — WhatsApp's two ways (founder 2026-10-14):
 *  - «موقعي الحالي»: one tap, a fixed pin for the trip;
 *  - «موقعي المباشر»: live for 15 min / 1 h / 8 h, from the phone in a pocket too
 *    (src/background/shareLocation.ts), ending by itself.
 * The teacher or an assistant at the centre; the server says who shares (`share.by`).
 */
export function useOrderShare(jobId: number | null, tripLive: boolean, server: TeacherShare | null | undefined) {
  const [live, setLive] = useState<LiveShare | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ShareResult | null>(null);
  const [, tick] = useState(0);
  const refresh = useCallback(() => { readLiveShare().then(setLive); }, []);
  useEffect(refresh, [refresh]);
  // the countdown, and noticing the end
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    refresh();
    const t = setInterval(() => { tick((n) => n + 1); refresh(); }, 30_000);
    return () => clearInterval(t);
  }, [refresh, focused]);

  const mineLive = !!live && live.jobId === jobId && live.until > Date.now();
  const mode: ShareMode = mineLive ? 'live'
    : server?.kind === 'static' ? 'static'
    : server?.kind === 'live' ? 'live_other' : 'off';

  // The trip ended: stop what this phone was sending.
  useEffect(() => {
    if (!tripLive && mineLive && jobId != null) stopLiveShare(jobId).then(refresh);
  }, [tripLive, mineLive, jobId, refresh]);

  const here = useMyLocation(mode === 'live');
  const me: MyPoint | null = mode === 'live' ? here.me
    : mode === 'static' && server ? { lat: server.lat, lng: server.lng } : null;

  const run = async (fn: () => Promise<ShareResult | void>) => {
    if (jobId == null || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await fn();
      if (r && r !== 'ok') setProblem(r);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return {
    mode, me, busy, problem,
    until: mineLive ? live!.until : server?.until ? new Date(server.until).getTime() : null,
    sentAt: server?.kind === 'static' ? server.seen_at : null,
    by: server?.by ?? null,
    sendStatic: () => run(() => sendStaticLocation(jobId!)),
    startLive: (minutes: number) => run(() => startLiveShare(jobId!, minutes)),
    stop: () => run(() => stopLiveShare(jobId!)),
  };
}

/** WhatsApp's live-location mark: a dot with waves breathing out (native driver, only while live). */
function LiveDot({ color, size = 14 }: { color: string; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }} />
      <View style={{ width: size * 0.64, height: size * 0.64, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

function left(until: number | null, t: TFunction): string {
  if (!until) return '';
  const m = Math.max(1, Math.round((until - Date.now()) / 60_000));
  return m >= 60 ? t('print.share_left_h', { h: formatNumber(Math.floor(m / 60)), m: formatNumber(m % 60) }) : t('print.share_left_m', { m: formatNumber(m) });
}

/**
 * The controls over the order map: two pills when nothing is shared; the live pill with what
 * is left and «إيقاف»; the fixed pin with when it was sent. The length sheet opens from «مباشر».
 */
export function OrderSharePanel({ share }: { share: ReturnType<typeof useOrderShare> }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false);
  const pill = (bg: string) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, height: 40, paddingHorizontal: 13, borderRadius: 20, backgroundColor: bg, ...shadows.md });
  const LENGTH_LABEL: Record<number, string> = { 15: t('print.share_15m'), 60: t('print.share_1h'), 480: t('print.share_8h') };

  return (
    <View style={{ gap: 8, alignItems: 'flex-start' }}>
      {share.mode === 'live' ? (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={pill(colors.success)}>
            <LiveDot color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('print.share_live_on')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{left(share.until, t)}</Text>
          </View>
          <TouchableOpacity onPress={share.stop} disabled={share.busy} accessibilityRole="button" style={pill(colors.surface)}>
            {share.busy ? <ActivityIndicator size="small" color={colors.danger} /> : <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>{t('print.share_stop')}</Text>}
          </TouchableOpacity>
        </View>
      ) : share.mode === 'live_other' ? (
        <View style={pill(colors.successLight)}>
          <LiveDot color={colors.success} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.successText }}>{t('print.share_by_other', { name: share.by ?? '' })}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.successText }}>{left(share.until, t)}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <TouchableOpacity onPress={share.sendStatic} disabled={share.busy} activeOpacity={0.85} accessibilityRole="button" style={pill(colors.surface)}>
            {share.busy ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="pin" size={17} color={share.mode === 'static' ? colors.success : colors.brand} />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>
              {share.mode === 'static' ? t('print.share_static_sent', { at: share.sentAt ? formatTime(share.sentAt) : '' }) : t('print.share_static')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPicking(true)} disabled={share.busy} activeOpacity={0.85} accessibilityRole="button" style={pill(colors.surface)}>
            <Icon name="live" size={17} color={colors.success} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t('print.share_live')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {share.problem ? (
        <View style={{ backgroundColor: colors.warningLight, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningText }}>
            {share.problem === 'denied' ? t('print.sharing_denied') : share.problem === 'no_fix' ? t('print.share_no_fix') : t('print.share_failed')}
          </Text>
        </View>
      ) : null}

      <SheetModal visible={picking} onClose={() => setPicking(false)}>
        <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="live" size={21} color={colors.success} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('print.share_live_title')}</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.sm }}>{t('print.share_live_sub')}</Text>
          {SHARE_LENGTHS.map((m) => (
            <TouchableOpacity key={m} onPress={() => { setPicking(false); share.startLive(m); }} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <Icon name="clock" size={18} color={colors.textSecondary} />
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{LENGTH_LABEL[m]}</Text>
              <Icon name="back" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </SheetModal>
    </View>
  );
}
