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
import { connectionView, syncAge, type ConnState, type ConnView } from '@/utils/connectionState';
import { SheetModal } from '@/components/ui/SheetModal';
import { syncNow } from '@/db/autoSync';

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
  const role = useAuthStore((s) => s.role);
  const staff = role === 'teacher' || role === 'assistant';
  const [open, setOpen] = useState(false);
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
    weak, syncing,
  );
  const c = tone(view.state);
  const stateLine = describe(view.state, String(net.type), details.cellularGeneration ?? null, t);
  const gen = details.cellularGeneration ? details.cellularGeneration.toUpperCase() : null;
  const main = view.state === 'offline' ? t('connection.line_offline')
    : view.state === 'weak' ? t('connection.line_weak')
    : view.state === 'syncing' ? t('connection.line_syncing')
    : view.link === 'cellular' ? (gen ? t('connection.line_cellular_gen', { gen }) : t('connection.line_cellular'))
    : t('connection.line_wifi');

  // The second detail, staff only: waiting first (it is what they can act on), else the last sync.
  const waiting = pending + rejected;
  let extra: string | null = null;
  if (staff && view.state !== 'syncing') {
    if (waiting > 0) extra = t('connection.line_pending', { count: waiting });
    else {
      const age = syncAge(lastSyncAt, now);
      if (age.key !== 'never') extra = t('connection.line_synced', { age: t(`connection.${age.key}`, { n: age.n !== undefined ? formatNumber(age.n) : undefined }) });
    }
  }
  const calm = view.state === 'online';

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
          backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: calm ? colors.onHeroChipBorder : c,
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
            <Text style={{ fontFamily: waiting > 0 ? fonts.bold : fonts.regular, color: waiting > 0 ? (rejected > 0 ? colors.danger : colors.onHero) : colors.onHeroFaint }}>
              {`  ·  ${extra}`}
            </Text>
          ) : null}
        </Text>
      </TouchableOpacity>

      <ConnectionSheet visible={open} onClose={() => setOpen(false)} view={view} stateLine={stateLine} staff={staff} />
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

function ConnectionSheet({ visible, onClose, view, stateLine, staff }: { visible: boolean; onClose: () => void; view: ConnView; stateLine: string; staff: boolean }) {
  const state = view.state;
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
            : <Glyph view={view} color={c} faint={colors.border} size={26} />}
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
