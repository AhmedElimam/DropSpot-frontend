import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, LayoutAnimation, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { useRose } from '@/hooks/useRose';
import { RoseLive } from './RoseLive';
import { RosePortrait } from './RoseStamp';
import type { RoseActivity } from './RoseProps';
import type { RoseSheet } from '@/api/cash';
import { ExportPill } from './RoseExport';
import { SheetDetail, type SheetDetailTarget } from './SheetDetail';

/**
 * The top of مدام روز's desk, as in her story videos (founder 2026-10-07: «her frame
 * character takes the upper section and looks bigger, like the video»): deep navy in both
 * schemes, her framed portrait large and centred — the Dros Spot crown on its rim — breathing
 * gently and alive (RoseLive: eyes, blinks, lips, hoops, reactions), her name under it, and a speech bubble pointing up at her with what she says now:
 * the greeting (typed out, as in the video), the week or the season, and «ورقة النهارده».
 *
 * A teacher who switched her name off gets the same navy band with the bubble only — no
 * portrait, the generic title — so nothing on the screen speaks as her.
 */
const ON = '#FFFFFF';
const ON_SOFT = 'rgba(255,255,255,0.72)';
const CHIP = 'rgba(255,255,255,0.12)';
const CHIP_BORDER = 'rgba(255,255,255,0.22)';

// A little smaller than the first cut (founder 2026-10-07), still the band's centre.
const PORTRAIT = 148;

export function RoseHero({
  greeting, sub, sheet, activity = 'cash', live = true, hold, onBack, onSettings, onExportAll, exportingAll = false, onExportSheet, exportingSheet = false, children,
}: {
  greeting: string;
  sub: string;
  /** «ورقة النهارده»; null / nothing to say = no sheet block. */
  sheet: RoseSheet | null;
  /** The tab on screen — what she holds (her ledger, a sheet, the stamp). */
  activity?: RoseActivity;
  /** False while the page is still sliding in: her still portrait, nothing typed yet — the
   *  live face (a dozen vector layers) mounts once the screen has arrived. */
  live?: boolean;
  /** From useRoseHold: the page is scrolling, or she is out of sight — she holds still. */
  hold?: RoseHold;
  onBack: () => void;
  onSettings?: () => void;
  /** «تصدير PDF» of her whole desk (the top bar) and of today's sheet (under it). */
  onExportAll?: () => void;
  exportingAll?: boolean;
  onExportSheet?: () => void;
  exportingSheet?: boolean;
  /** Cards under the bubble (viewing a past period, a load error). */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const rose = useRose();
  const [open, setOpen] = useState(false);
  // Only the greeting line re-renders while it types; the hero hears when she starts and stops.
  const [talking, setTalking] = useState(false);
  const paused = useSyncExternalStore(hold?.subscribe ?? noSubscribe, hold?.get ?? never);

  const square = (icon: 'forward' | 'settings' | 'download', onPress: () => void, label: string, busy = false) => (
    <TouchableOpacity onPress={onPress} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center' }}>
      {busy ? <ActivityIndicator size="small" color={ON} /> : <Icon name={icon} size={icon === 'forward' ? 22 : 20} color={ON} outline={icon === 'settings'} />}
    </TouchableOpacity>
  );

  return (
    <LinearGradient onLayout={hold?.onHeroLayout} colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {square('forward', onBack, t('common.back'))}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {onExportAll ? square('download', onExportAll, t('cash.export_all'), exportingAll) : null}
          {onSettings ? square('settings', onSettings, t('cash.settings_title')) : null}
          {!onExportAll && !onSettings ? <View style={{ width: 40 }} /> : null}
        </View>
      </View>

      {rose.named ? (
        <View style={{ alignItems: 'center', marginTop: -spacing.lg }}>
          {/* No halo behind her (founder 2026-10-07): the frame sits straight on the navy. */}
          {live ? <RoseLive size={PORTRAIT} talking={talking} paused={paused} activity={activity} /> : <RosePortrait size={PORTRAIT} nod={false} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: ON, marginTop: spacing.xs }}>{rose.name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: ON_SOFT }}>{t('cash.screen_title')}</Text>
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: ON, textAlign: 'center', marginTop: -spacing.xl }}>{rose.name}</Text>
      )}

      {/* Her speech bubble, pointing up at her. */}
      <View style={{ marginTop: spacing.md }}>
        <View style={{ alignSelf: 'center', width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.surface }} />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
          {/* Centred (founder 2026-10-07). The untyped rest is drawn transparent, so the line
              keeps its full width while it types and the centred text never shifts. */}
          <TypedGreeting text={greeting} start={live} onTalking={setTalking} />
          {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>{sub}</Text> : null}
          {sheet && sheet.lines.length > 0 ? <SheetList sheet={sheet} open={open} onToggle={() => setOpen((o) => !o)} onExport={onExportSheet} exporting={exportingSheet} /> : null}
        </View>
      </View>

      {children}
    </LinearGradient>
  );
}

const noSubscribe = () => () => {};
const never = () => false;

export interface RoseHold {
  get: () => boolean;
  subscribe: (l: () => void) => () => void;
  onHeroLayout: (e: LayoutChangeEvent) => void;
  /** Spread on the page's ScrollView. */
  scrollProps: {
    onScrollBeginDrag: () => void;
    onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollBegin: () => void;
    onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  };
}

/**
 * She holds still while the page under her moves, and stays still once she is scrolled out of
 * sight (founder 2026-10-08: «the phone heats up while scrolling her tab»): on Android every
 * frame she moves re-commits the page, and a scroll is the worst moment to add that. Only the
 * hero listens — the page itself does not re-render when a scroll starts or stops.
 */
export function useRoseHold(): RoseHold {
  const heroH = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
  return useMemo(() => {
    let held = false;
    let scrolling = false;
    let out = false;
    const listeners = new Set<() => void>();
    const apply = () => {
      const next = scrolling || out;
      if (next !== held) { held = next; listeners.forEach((l) => l()); }
    };
    const rest = (y: number) => {
      scrolling = false;
      // Out of sight once the band's lower part has gone under the sticky segments.
      out = heroH.current > 0 && y > heroH.current - 80;
      apply();
    };
    const cancelSettle = () => { if (settle.current) { clearTimeout(settle.current); settle.current = null; } };
    return {
      get: () => held,
      subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
      onHeroLayout: (e) => { heroH.current = e.nativeEvent.layout.height; },
      scrollProps: {
        onScrollBeginDrag: () => { cancelSettle(); scrolling = true; apply(); },
        // A fling goes on into momentum; a plain lift ends here (momentum never starts).
        onScrollEndDrag: (e) => {
          const y = e.nativeEvent.contentOffset.y;
          cancelSettle();
          settle.current = setTimeout(() => rest(y), 160);
        },
        onMomentumScrollBegin: cancelSettle,
        onMomentumScrollEnd: (e) => { cancelSettle(); rest(e.nativeEvent.contentOffset.y); },
      },
    };
  }, []);
}

/** A card on her navy band (past period, load error): white on a translucent chip. */
export function RoseHeroCard({ icon, title, sub, onPress, chevron = false }: { icon: 'calendar' | 'refresh'; title: string; sub?: string; onPress: () => void; chevron?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: CHIP, borderRadius: radius.xl, borderWidth: 1, borderColor: CHIP_BORDER, padding: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name={icon} size={22} color={ON} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: ON }}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: ON_SOFT, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {chevron ? <Icon name="back" size={18} color={ON} /> : null}
    </TouchableOpacity>
  );
}

/**
 * Her greeting typed out once, as in the videos (~28 ms a letter); a new text starts over.
 * Its own component, so each letter re-renders this one line — not her face and the sheet.
 * The untyped rest is drawn transparent: the centred line keeps its width and never shifts.
 */
function TypedGreeting({ text, start, onTalking }: { text: string; start: boolean; onTalking: (talking: boolean) => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text || !start) return;
    onTalking(true);
    const id = setInterval(() => setN((k) => {
      if (k >= text.length) { clearInterval(id); onTalking(false); return k; }
      return k + 1;
    }), 28);
    return () => { clearInterval(id); onTalking(false); };
  }, [text, start, onTalking]);
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.brand, minHeight: 28, textAlign: 'center' }}>
      {text.slice(0, n)}<Text style={{ color: 'transparent' }}>{text.slice(n)}</Text>
    </Text>
  );
}

const FACT = (): Record<string, { icon: 'warning' | 'success' | 'money' | 'note' | 'eye'; tint: string }> => ({
  dues: { icon: 'warning', tint: colors.danger },
  dues_clear: { icon: 'success', tint: colors.success },
  collected: { icon: 'money', tint: colors.success },
  complaints: { icon: 'note', tint: colors.accent },
  review: { icon: 'eye', tint: colors.brand },
});

/**
 * «ورقة النهارده», listed (founder 2026-10-08: «make it listed and organised»): her opening
 * line, then one row per session — the time in its own pill, what and which grade, where,
 * and attendance once it has ended — then each fact on its own row with its icon. Three
 * sessions show; the rest on a tap. An older server sends only `lines`: those, one per row.
 */
const SEEN_KEY = 'rose_sheet_seen_day';
const AUTO_FOLD_MS = 10_000;
// One native layout pass (Core Animation / the Android animator) moves the sheet AND everything
// under it together — animating `height` frame by frame re-laid out the whole page each frame
// and stuttered (founder 2026-10-08: «not smooth, and slow»).
const FOLD_MS = 240;
const FOLD_ANIM = {
  duration: FOLD_MS,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Folding (founder 2026-10-08: «auto-minimise today's sheet after ~10 s; after that it is
 * minimised by default when entering her page — per day — and can be toggled, animated and
 * smooth»): the FIRST visit of the day opens it, and it folds itself away 10 s later unless
 * the person has touched it; every later visit that day starts folded. A tap on its heading
 * opens or folds it at any time. The body slides on its measured height with a fade; the
 * heading keeps a one-line summary, so a folded sheet still says what the day is.
 */
function useSheetFold() {
  const [open, setOpen] = useState(false);
  const touched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p = useSharedValue(0);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(SEEN_KEY).then((seen) => {
      if (!live || touched.current) return;
      const d = today();
      if (seen === d) return; // already seen today → stays folded
      LayoutAnimation.configureNext(FOLD_ANIM);
      setOpen(true);
      AsyncStorage.setItem(SEEN_KEY, d).catch(() => {});
      timer.current = setTimeout(() => { if (!touched.current) { LayoutAnimation.configureNext(FOLD_ANIM); setOpen(false); } }, AUTO_FOLD_MS);
    }).catch(() => {});
    return () => { live = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => { p.value = withTiming(open ? 1 : 0, { duration: FOLD_MS, easing: Easing.out(Easing.cubic) }); }, [open, p]);
  const toggle = () => {
    touched.current = true;
    if (timer.current) clearTimeout(timer.current);
    LayoutAnimation.configureNext(FOLD_ANIM);
    setOpen((o) => !o);
  };
  return { open, toggle, p };
}

function SheetList({ sheet, open: all, onToggle, onExport, exporting }: { sheet: RoseSheet; open: boolean; onToggle: () => void; onExport?: () => void; exporting: boolean }) {
  const { t } = useTranslation();
  const sessions = sheet.sessions;
  // Natural alignment = the right side under the app's RTL (an explicit 'right' is swapped to the left on iOS).
  const right = {};
  const open = all;
  const fold = useSheetFold();
  // Every line opens what stands behind it (founder 2026-10-08).
  const [detail, setDetail] = useState<SheetDetailTarget | null>(null);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${180 * fold.p.value}deg` }] }));

  return (
    <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TouchableOpacity onPress={fold.toggle} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded: fold.open }} accessibilityLabel={t('cash.sheet_title')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.accent + '1F', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="calendar" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, ...right }}>{t('cash.sheet_title')}</Text>
            {sheet.head ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, ...right }} numberOfLines={2}>{sheet.head}</Text> : null}
          </View>
          <Animated.View style={chevron}><Icon name="down" size={18} color={colors.textTertiary} /></Animated.View>
        </TouchableOpacity>
        {onExport ? <ExportPill onPress={onExport} busy={exporting} /> : null}
      </View>

      {fold.open ? (
        <View>
      {sessions ? (
        <>
          {(open ? sessions : sessions.slice(0, 3)).map((x, i) => (
            <TouchableOpacity key={i} onPress={() => setDetail({ type: 'session', session: x })} activeOpacity={0.8} accessibilityRole="button" accessibilityHint="التفاصيل"
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}>
              <View style={{ minWidth: 62, paddingHorizontal: 8, height: 28, borderRadius: radius.md, backgroundColor: colors.brand + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }} numberOfLines={1}>{x.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary, ...right }}>{x.title}</Text>
                {x.venue ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Icon name="location" size={12} color={colors.textTertiary} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{x.venue}</Text>
                  </View>
                ) : null}
                {x.exam || x.present !== null ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {x.exam ? <Pill text={t('cash.sheet_exam')} tint={colors.info} /> : null}
                    {x.present !== null ? <Pill text={t('cash.sheet_present', { n: formatNumber(x.present) })} tint={colors.success} /> : null}
                    {x.absent !== null && x.absent > 0 ? <Pill text={t('cash.sheet_absent', { n: formatNumber(x.absent) })} tint={colors.danger} /> : null}
                  </View>
                ) : null}
              </View>
              <Icon name="back" size={14} color={colors.textTertiary} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
          ))}
          {sessions.length > 3 ? (
            <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(FOLD_ANIM); onToggle(); }} hitSlop={6} style={{ alignSelf: 'center', marginTop: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{open ? t('cash.sheet_less') : t('cash.sheet_more', { count: formatNumber(sessions.length) })}</Text>
            </TouchableOpacity>
          ) : null}
          {(sheet.facts ?? []).length > 0 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {(sheet.facts ?? []).map((f, i) => {
                const look = FACT()[f.kind] ?? { icon: 'note' as const, tint: colors.textSecondary };
                return (
                  <TouchableOpacity key={i} onPress={() => setDetail({ type: 'fact', kind: f.kind, text: f.text, items: f.items })} activeOpacity={0.8} accessibilityRole="button" accessibilityHint="التفاصيل"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: look.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={look.icon} size={15} color={look.tint} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textPrimary, ...right }}>{f.text}</Text>
                    <Icon name="back" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        sheet.lines.slice(sheet.head ? 1 : 0).map((line, i) => (
          <Text key={i} style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, ...right }}>{line}</Text>
        ))
      )}
          <View style={{ height: spacing.xs }} />
        </View>
      ) : null}
      <SheetDetail target={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

function Pill({ text, tint }: { text: string; tint: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: tint + '1A' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tint }}>{text}</Text>
    </View>
  );
}
