import { memo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, spacing, radius } from '@/theme/index';
import { fonts } from '@/theme/typography';
import { formatNumber } from '@/utils/format';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore } from '@/stores/authStore';
import { connectionView, isStale, syncAge, type ConnState, type ConnView, type PendingByKind } from '@/utils/connectionState';
import { SheetModal } from '@/components/ui/SheetModal';
import { syncNow } from '@/db/autoSync';
import { configRule } from '@/stores/appConfigStore';
import client from '@/api/client';
import { backgroundLastRun } from '@/background/lastRun';
import { Icon } from '@/components/ui/Icon';

/** Wi-Fi: a dot and three waves; the lit waves are the signal, offline crosses it out. */
const WifiGlyph = memo(function WifiGlyph({ lit, color, faint, slash, size }: { lit: number; color: string; faint: string; slash?: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.4 8.8a13.6 13.6 0 0 1 19.2 0" stroke={lit >= 3 ? color : faint} strokeWidth={2.3} strokeLinecap="round" />
      <Path d="M5.5 12a9.2 9.2 0 0 1 13 0" stroke={lit >= 2 ? color : faint} strokeWidth={2.3} strokeLinecap="round" />
      <Path d="M8.6 15.2a4.8 4.8 0 0 1 6.8 0" stroke={lit >= 1 ? color : faint} strokeWidth={2.3} strokeLinecap="round" />
      <Circle cx={12} cy={18.6} r={1.7} fill={lit >= 1 ? color : faint} />
      {slash ? <Path d="M4 3.5 L20 20.5" stroke={slash} strokeWidth={2.3} strokeLinecap="round" /> : null}
    </Svg>
  );
});

/** Mobile data: four rising bars, as on the phone's own status bar. */
const BarsGlyph = memo(function BarsGlyph({ lit, color, faint, slash, size }: { lit: number; color: string; faint: string; slash?: string; size: number }) {
  // 0–3 strength → 0–4 bars (3 = all four).
  const on = lit >= 3 ? 4 : lit;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={15} width={3.6} height={5.5} rx={1.2} fill={on >= 1 ? color : faint} />
      <Rect x={7.6} y={11.5} width={3.6} height={9} rx={1.2} fill={on >= 2 ? color : faint} />
      <Rect x={12.7} y={8} width={3.6} height={12.5} rx={1.2} fill={on >= 3 ? color : faint} />
      <Rect x={17.8} y={4.5} width={3.6} height={16} rx={1.2} fill={on >= 4 ? color : faint} />
      {slash ? <Path d="M3.5 3.5 L20.5 20.5" stroke={slash} strokeWidth={2.3} strokeLinecap="round" /> : null}
    </Svg>
  );
});

function Glyph({ view, color, faint, size }: { view: ConnView; color: string; faint: string; size: number }) {
  const slash = view.state === 'offline' ? colors.danger : undefined;
  return view.link === 'cellular'
    ? <BarsGlyph lit={view.bars} color={color} faint={faint} slash={slash} size={size} />
    : <WifiGlyph lit={view.bars} color={color} faint={faint} slash={slash} size={size} />;
}

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
        <Path d="M14.5 7.2A6 6 0 0 0 3.8 5.4" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M3.5 2.4v3.3h3.3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3.5 10.8a6 6 0 0 0 10.7 1.8" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M14.5 15.6v-3.3h-3.3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

function tone(state: ConnState): string {
  switch (state) {
    case 'offline': return colors.danger;
    case 'server': return colors.danger;
    case 'weak': return colors.warning;
    case 'syncing': return colors.primary;
    default: return colors.success;
  }
}

/**
 * The live connection line under the greeting on every home (founder 2026-10-10: «a live
 * status of connection … a smart icon», «put some love on it» — chosen spot: under the
 * greeting, so it reads as part of the page, not as another button).
 *
 * A quiet pill: the icon that matches the link (Wi-Fi waves, or mobile bars; lit = signal,
 * colour = state, crossed out offline) and one short phrase. Staff also get the one thing
 * worth knowing next — what is waiting to be sent, or when it last synced. Tap: the sheet
 * with the whole story and «إرسال الآن». Nothing animates unless a pass is sending.
 */
export function ConnectionLine({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const net = useNetInfo();
  const weak = useOfflineStore((s) => s.weak);
  const syncing = useOfflineStore((s) => s.syncing);
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const lastSyncAt = useOfflineStore((s) => s.lastSyncAt);
  const lastSyncFailedAt = useOfflineStore((s) => s.lastSyncFailedAt);
  const serverOkAt = useOfflineStore((s) => s.serverOkAt);
  const serverFailures = useOfflineStore((s) => s.serverFailures);
  const launchedAt = useOfflineStore((s) => s.launchedAt);
  const role = useAuthStore((s) => s.role);
  const staff = role === 'teacher' || role === 'assistant';
  const [open, setOpen] = useState(false);
  // «آخر مزامنة» is on disk now — read it back once, so a fresh launch does not say «لم تتم بعد».
  useEffect(() => { void useOfflineStore.getState().hydrateSyncStamp(); }, []);
  // «آخر مزامنة منذ ٥ دقائق» stays true: a re-render a minute, no animation.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!staff) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [staff]);

  const details = (net.details ?? {}) as { strength?: number | null; cellularGeneration?: string | null };
  const view = connectionView(
    { isConnected: net.isConnected, isInternetReachable: net.isInternetReachable, type: String(net.type), strength: details.strength ?? null, cellularGeneration: details.cellularGeneration ?? null },
    weak, syncing, serverFailures, configRule('server_fail_flag_after') ?? 2,
  );
  // Online but no good answer from the server for a while: what is on screen is the saved copy.
  const stale = view.state === 'online' && isStale(serverOkAt, now, configRule('sync_stale_after_min') ?? 30, launchedAt);
  const c = tone(view.state);
  const stateLine = describe(view.state, String(net.type), details.cellularGeneration ?? null, t);
  const gen = details.cellularGeneration ? details.cellularGeneration.toUpperCase() : null;
  const main = view.state === 'offline' ? t('connection.line_offline')
    : view.state === 'server' ? t('connection.line_server')
    : view.state === 'weak' ? t('connection.line_weak')
    : view.state === 'syncing' ? t('connection.line_syncing')
    : view.link === 'cellular' ? (gen ? t('connection.line_cellular_gen', { gen }) : t('connection.line_cellular'))
    : t('connection.line_wifi');

  // The second detail: what needs a decision first, then what is waiting, then a failed pass,
  // then old data — the flags; only when all is well, the last sync.
  const waiting = pending + rejected;
  let extra: string | null = null;
  let flagged = false;
  if (view.state !== 'syncing') {
    if (staff && rejected > 0) { extra = t('connection.line_rejected', { count: rejected }); flagged = true; }
    else if (staff && pending > 0) { extra = t('connection.line_pending', { count: pending }); flagged = true; }
    else if (staff && lastSyncFailedAt && (!lastSyncAt || lastSyncFailedAt > lastSyncAt)) { extra = t('connection.line_sync_failed'); flagged = true; }
    else if (stale) {
      const age = syncAge(serverOkAt ?? launchedAt, now);
      extra = t('connection.line_stale', { age: t(`connection.${age.key}`, { n: age.n !== undefined ? formatNumber(age.n) : undefined }) });
      flagged = true;
    } else if (staff) {
      const age = syncAge(lastSyncAt, now);
      if (age.key !== 'never') extra = t('connection.line_synced', { age: t(`connection.${age.key}`, { n: age.n !== undefined ? formatNumber(age.n) : undefined }) });
    }
  }
  const calm = view.state === 'online' && !flagged;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('connection.a11y', { state: stateLine })}
        style={[{
          alignSelf: 'center', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 7,
          height: 30, paddingHorizontal: 12, borderRadius: 999,
          backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: calm ? colors.onHeroChipBorder : (view.state === 'online' ? colors.warning : c),
        }, style]}
      >
        {/* Words stay in the hero's own ink (amber text on the light hero does not read); the
            icon and the ring carry the state's colour. */}
        {view.state === 'syncing'
          ? <SyncArrows color={c} spinning size={14} />
          : <Glyph view={view} color={c} faint={colors.onHeroFaint} size={16} />}
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: calm ? fonts.medium : fonts.bold, fontSize: 12.5, color: calm ? colors.onHeroSoft : colors.onHero }}>
          {main}
          {extra ? (
            <Text style={{ fontFamily: flagged ? fonts.bold : fonts.regular, color: flagged ? (rejected > 0 ? colors.danger : colors.onHero) : colors.onHeroFaint }}>
              {`  ·  ${extra}`}
            </Text>
          ) : null}
        </Text>
      </TouchableOpacity>

      <ConnectionSheet visible={open} onClose={() => setOpen(false)} view={view} stateLine={stateLine} staff={staff} stale={stale} />
    </>
  );
}

function describe(state: ConnState, type: string, gen: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (state === 'offline') return t('connection.offline');
  if (state === 'server') return t('connection.server');
  if (state === 'weak') return t('connection.weak');
  if (state === 'syncing') return t('connection.syncing');
  if (type === 'wifi') return t('connection.wifi');
  if (type === 'cellular') return gen ? t('connection.cellular_gen', { gen: gen.toUpperCase() }) : t('connection.cellular');
  return t('connection.online');
}

function ConnectionSheet({ visible, onClose, view, stateLine, staff, stale }: { visible: boolean; onClose: () => void; view: ConnView; stateLine: string; staff: boolean; stale: boolean }) {
  const state = view.state;
  const { t } = useTranslation();
  const pending = useOfflineStore((s) => s.pending);
  const rejected = useOfflineStore((s) => s.rejected);
  const byKind = useOfflineStore((s) => s.pendingByKind);
  const lastSyncAt = useOfflineStore((s) => s.lastSyncAt);
  const lastSyncFailedAt = useOfflineStore((s) => s.lastSyncFailedAt);
  const serverOkAt = useOfflineStore((s) => s.serverOkAt);
  const serverFailures = useOfflineStore((s) => s.serverFailures);
  const syncing = useOfflineStore((s) => s.syncing);
  const [bgAt, setBgAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<{ at: number; ok: boolean } | null>(null);
  // «منذ ٥ دقائق» stays true while the sheet is open — refreshed on open and every 30 s.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    void useOfflineStore.getState().refresh();
    if (staff) void backgroundLastRun().then(setBgAt);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [visible, staff]);
  const c = tone(state);
  const hint = state === 'offline' ? t('connection.hint_offline')
    : state === 'server' ? t('connection.hint_server')
    : state === 'weak' ? t('connection.hint_weak')
    : stale ? t('connection.hint_stale')
    : t('connection.hint_online');
  const ago = (at: number | null) => {
    const a = syncAge(at, now);
    return t(`connection.${a.key}`, { n: a.n !== undefined ? formatNumber(a.n) : undefined });
  };
  const serverValue = serverFailures > 0 && state !== 'offline'
    ? t('connection.server_failing', { count: serverFailures })
    : serverOkAt ? t('connection.server_ok', { age: ago(serverOkAt) }) : t('connection.server_unknown');
  const kinds = [
    byKind.scans > 0 ? t('offline.on_phone_scans', { count: byKind.scans }) : null,
    byKind.marks > 0 ? t('offline.on_phone_marks', { count: byKind.marks }) : null,
    byKind.actions > 0 ? t('offline.on_phone_actions', { count: byKind.actions }) : null,
  ].filter(Boolean).join(' · ');
  const failedLast = !!lastSyncFailedAt && (!lastSyncAt || lastSyncFailedAt > lastSyncAt);

  /**
   * «تحقق الآن»: one sync pass and one question to the server, whatever is pending — so the
   * person can SEE it work, instead of trusting a quiet green line.
   */
  const checkNow = async () => {
    if (checking) return;
    setChecking(true);
    try {
      if (staff) await syncNow();
      let ok = true;
      try { await client.get('/app-config', { timeout: 8000 }); } catch { ok = false; }
      await useOfflineStore.getState().refresh();
      setChecked({ at: Date.now(), ok });
    } finally {
      setChecking(false);
      setNow(Date.now());
    }
  };
  const allClear = !!checked?.ok && pending === 0 && rejected === 0 && !failedLast;

  return (
    <SheetModal visible={visible} onClose={onClose} style={{ backgroundColor: colors.surface, padding: spacing.xl }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.lg }}>{t('connection.title')}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: (state === 'online' && stale) ? colors.warning : colors.border }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: c }}>
          {state === 'syncing'
            ? <SyncArrows color={c} spinning={visible} size={24} />
            : <Glyph view={view} color={c} faint={colors.border} size={26} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{stateLine}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 2 }}>{hint}</Text>
        </View>
      </View>

      {/* What was checked, line by line — the server, then (staff) what is on the phone. */}
      <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
        <Row label={t('connection.server_row')} value={serverValue} danger={serverFailures > 0 && state !== 'offline'} warn={stale && serverFailures === 0} />
        {staff ? (
          <>
            <Row label={t('connection.pending')} value={pending > 0 ? `${formatNumber(pending)}${kinds ? `  (${kinds})` : ''}` : t('connection.nothing_waiting')} strong={pending > 0} />
            <Row label={t('connection.rejected')} value={rejected > 0 ? formatNumber(rejected) : t('connection.none')} danger={rejected > 0} />
            <Row label={t('connection.last_sync')} value={failedLast ? t('connection.sync_failed_at', { age: ago(lastSyncFailedAt) }) : ago(lastSyncAt)} danger={failedLast} />
            <Row label={t('connection.background_row')} value={bgAt ? ago(bgAt) : t('connection.never')} />
          </>
        ) : null}
      </View>

      {checked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: allClear ? colors.successLight : colors.warningLight }}>
          <Icon name={allClear ? 'success' : 'warning'} size={16} color={allClear ? colors.successText : colors.warningText} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: allClear ? colors.successText : colors.warningText }}>
            {!checked.ok ? t('connection.check_server_down')
              : allClear ? t('connection.check_all_clear')
              : rejected > 0 ? t('connection.check_needs_you', { count: rejected })
              : t('connection.check_still_waiting', { count: pending })}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <TouchableOpacity onPress={() => { void checkNow(); }} disabled={checking || syncing || state === 'offline'} activeOpacity={0.85} accessibilityRole="button"
          style={{ flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', opacity: (checking || syncing || state === 'offline') ? 0.5 : 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textInverse }}>
            {checking || syncing ? t('connection.checking') : pending > 0 && staff ? t('connection.send_now') : t('connection.check_now')}
          </Text>
        </TouchableOpacity>
        {staff ? (
          <TouchableOpacity onPress={() => { onClose(); router.push('/(teacher)/reconcile' as Href); }} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{t('connection.details')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SheetModal>
  );
}

function Row({ label, value, strong, danger, warn }: { label: string; value: string; strong?: boolean; danger?: boolean; warn?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: 6 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'left', fontFamily: strong || danger || warn ? fonts.bold : fonts.medium, fontSize: 14, color: danger ? colors.dangerText : warn ? colors.warningText : colors.textPrimary }}>{value}</Text>
    </View>
  );
}
