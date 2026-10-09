import { memo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { formatNumber } from '@/utils/format';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore } from '@/stores/authStore';
import { connectionView, syncAge, type ConnState } from '@/utils/connectionState';
import { SheetModal } from '@/components/ui/SheetModal';
import { syncNow } from '@/db/autoSync';

/** Three rising bars; the unfilled ones stay faint, and offline draws a slash through them. */
const Bars = memo(function Bars({ bars, color, faint, slash, size = 18 }: { bars: number; color: string; faint: string; slash?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Rect x={2} y={11} width={3.4} height={5} rx={1} fill={bars >= 1 ? color : faint} />
      <Rect x={7.3} y={7} width={3.4} height={9} rx={1} fill={bars >= 2 ? color : faint} />
      <Rect x={12.6} y={3} width={3.4} height={13} rx={1} fill={bars >= 3 ? color : faint} />
      {slash ? <Path d="M2.5 2.5 L15.5 15.5" stroke={slash} strokeWidth={2} strokeLinecap="round" /> : null}
    </Svg>
  );
});

/** Two arrows chasing round — turns only while a sync pass is sending, then stops. */
function SyncArrows({ color, spinning, size = 18 }: { color: string; spinning: boolean; size?: number }) {
  const still = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (spinning && !still) {
      turn.value = 0;
      turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(turn);
      turn.value = 0;
    }
    return () => cancelAnimation(turn);
  }, [spinning, still, turn]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View style={st}>
      <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
        <Path d="M14.5 7.2A6 6 0 0 0 3.8 5.4" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
        <Path d="M3.5 2.4v3.3h3.3" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3.5 10.8a6 6 0 0 0 10.7 1.8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
        <Path d="M14.5 15.6v-3.3h-3.3" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

function tone(state: ConnState): string {
  switch (state) {
    case 'offline': return colors.danger;
    case 'weak': return colors.warning;
    case 'syncing': return colors.primary;
    default: return colors.success;
  }
}

/**
 * The live connection chip in every home header, beside the bell (founder 2026-10-10:
 * «a live status of connection with a little indicator and a smart icon»).
 *
 * - Online: signal bars in green, as many as the link is worth (Wi-Fi strength, 2G/3G/4G).
 * - Weak: one amber bar and «ضعيف» — the link is poor, or a request just went unanswered.
 * - Offline: faint bars with a red slash and «بدون نت».
 * - Sending: arrows turning while a sync pass runs, then back to the bars.
 * - Something waiting to be sent: its count on the corner.
 *
 * Tap: a sheet with the whole story — how it is connected, what is waiting, when it last
 * synced, and «إرسال الآن». Nothing animates unless a pass is sending.
 */
export function ConnectionStatus() {
  const { t } = useTranslation();
  const net = useNetInfo();
  const weak = useOfflineStore((s) => s.weak);
  const syncing = useOfflineStore((s) => s.syncing);
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const role = useAuthStore((s) => s.role);
  const staff = role === 'teacher' || role === 'assistant';
  const [open, setOpen] = useState(false);

  const details = (net.details ?? {}) as { strength?: number | null; cellularGeneration?: string | null };
  const view = connectionView(
    { isConnected: net.isConnected, isInternetReachable: net.isInternetReachable, type: String(net.type), strength: details.strength ?? null, cellularGeneration: details.cellularGeneration ?? null },
    weak, syncing,
  );
  const c = tone(view.state);
  const waiting = staff ? pending + rejected : 0;
  const chipLabel = view.state === 'offline' ? t('connection.chip_offline') : view.state === 'weak' ? t('connection.chip_weak') : view.state === 'syncing' ? t('connection.chip_syncing') : null;
  const stateLine = describe(view.state, String(net.type), details.cellularGeneration ?? null, t);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('connection.a11y', { state: stateLine })}
        style={{
          height: 44, minWidth: 44, paddingHorizontal: chipLabel ? 10 : 0, borderRadius: 14,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: view.state === 'online' ? colors.onHeroChipBorder : c,
        }}
      >
        {view.state === 'syncing'
          ? <SyncArrows color={c} spinning />
          : <Bars bars={view.bars} color={c} faint={colors.onHeroFaint} slash={view.state === 'offline' ? colors.danger : undefined} />}
        {chipLabel ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c }}>{chipLabel}</Text> : null}
        {waiting > 0 ? (
          <View style={{ position: 'absolute', top: -5, insetInlineEnd: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: rejected > 0 ? colors.danger : colors.primary, borderWidth: 2, borderColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{waiting > 9 ? '9+' : formatNumber(waiting)}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <ConnectionSheet
        visible={open}
        onClose={() => setOpen(false)}
        state={view.state}
        bars={view.bars}
        stateLine={stateLine}
        staff={staff}
      />
    </>
  );
}

function describe(state: ConnState, type: string, gen: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (state === 'offline') return t('connection.offline');
  if (state === 'weak') return t('connection.weak');
  if (state === 'syncing') return t('connection.syncing');
  if (type === 'wifi') return t('connection.wifi');
  if (type === 'cellular') return gen ? t('connection.cellular_gen', { gen: gen.toUpperCase() }) : t('connection.cellular');
  return t('connection.online');
}

function ConnectionSheet({ visible, onClose, state, bars, stateLine, staff }: { visible: boolean; onClose: () => void; state: ConnState; bars: number; stateLine: string; staff: boolean }) {
  const { t } = useTranslation();
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const lastSyncAt = useOfflineStore((s) => s.lastSyncAt);
  const syncing = useOfflineStore((s) => s.syncing);
  // «منذ ٥ دقائق» stays true while the sheet is open — refreshed on open and every 30 s.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [visible]);
  const c = tone(state);
  const hint = state === 'offline' ? t('connection.hint_offline') : state === 'weak' ? t('connection.hint_weak') : t('connection.hint_online');
  const age = syncAge(lastSyncAt, now);
  const ageText = t(`connection.${age.key}`, { n: age.n !== undefined ? formatNumber(age.n) : undefined });
  const canSend = staff && pending > 0 && state !== 'offline' && !syncing;

  return (
    <SheetModal visible={visible} onClose={onClose} style={{ backgroundColor: colors.surface, padding: spacing.xl }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.lg }}>{t('connection.title')}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: c }}>
          {state === 'syncing'
            ? <SyncArrows color={c} spinning={visible} size={24} />
            : <Bars bars={bars} color={c} faint={colors.border} slash={state === 'offline' ? colors.danger : undefined} size={24} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{stateLine}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2 }}>{hint}</Text>
        </View>
      </View>

      {staff ? (
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <Row label={t('connection.pending')} value={formatNumber(pending)} strong={pending > 0} />
          {rejected > 0 ? <Row label={t('connection.rejected')} value={formatNumber(rejected)} danger /> : null}
          <Row label={t('connection.last_sync')} value={ageText} />
        </View>
      ) : null}

      {staff && (canSend || pending > 0 || rejected > 0) ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          {canSend ? (
            <TouchableOpacity onPress={() => { void syncNow(); }} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textInverse }}>{t('connection.send_now')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => { onClose(); router.push('/(teacher)/reconcile' as Href); }} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{t('connection.details')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SheetModal>
  );
}

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: strong || danger ? fonts.bold : fonts.medium, fontSize: 14, color: danger ? colors.dangerText : colors.textPrimary }}>{value}</Text>
    </View>
  );
}
