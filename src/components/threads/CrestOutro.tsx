import { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image as RNImage, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeInDown, cancelAnimation, interpolate, Extrapolation, useAnimatedProps, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient as SvgLinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import {
  CREST_GOLD, CREST_GOLD_DEEP, CREST_GOLD_LIGHT, CREST_NAVY, CREST_NAVY_DEEP, LAUREL_STATIONS, LEAF_SPREAD, crestGeometry, leafPath,
  type CrestGeometry, type LeafStation,
} from './crest';
import { subjectLine, viewerLine, watchedOn } from './parents';

const brandLogo = require('@/assets/images/brand-logo.png');
const LOGO_ASPECT = 1.14;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The timeline, ms from the last frame (≈4 s, then it holds; only the watermark keeps moving).
const T = {
  ring: 120, ringFor: 1100,
  disc: 150,
  stems: 650, stemsFor: 650,
  leaves: 800, leafEach: 150,
  medal: 1850, shimmer: 2350,
  title: 1950, ribbon: 2200, subject: 2500,
  data: 2750, buttons: 3800,
};

/**
 * The DS crest medallion: a navy disc, a gold double ring, the emblem in gold. Static — the
 * outro animates the View around it; the player's corner mark uses it tiny.
 */
export const CrestMedallion = memo(function CrestMedallion({ size }: { size: number }) {
  const stroke = Math.max(1.2, size * 0.07);
  const logoH = size * 0.42;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="mdisc" cx="50%" cy="38%" r="62%">
            <Stop offset="0" stopColor={CREST_NAVY} />
            <Stop offset="1" stopColor={CREST_NAVY_DEEP} />
          </RadialGradient>
          <SvgLinearGradient id="mring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={CREST_GOLD_LIGHT} />
            <Stop offset="0.55" stopColor={CREST_GOLD} />
            <Stop offset="1" stopColor={CREST_GOLD_DEEP} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - stroke / 2} fill="url(#mdisc)" stroke="url(#mring)" strokeWidth={stroke} />
        {size >= 28 ? <Circle cx={size / 2} cy={size / 2} r={size / 2 - stroke * 2.1} fill="none" stroke={CREST_GOLD} strokeWidth={Math.max(0.6, size * 0.018)} opacity={0.75} /> : null}
      </Svg>
      <RNImage source={brandLogo} style={{ height: logoH, width: Math.round(logoH * LOGO_ASPECT), tintColor: CREST_GOLD_LIGHT }} resizeMode="contain" />
    </View>
  );
});

/**
 * The end card, in Madam Rose's crest language (founder 2026-10-15: «more love on the logo part
 * at the end … more data like the website … the same crest border»). In order: the gold ring
 * draws itself up both sides, the laurel pops in pair by pair from the bottom, the DS medallion
 * drops onto the top of the ring with a bounce and a gold shimmer; inside the navy disc «حكاوي»,
 * a ribbon with the teacher's name, the subject and grade; under the frame the website, the app,
 * who watched with the play code, the day, and whose rights these are. Then «شوف تاني» / «رجوع».
 *
 * Every motion runs on the UI thread (Reanimated shared values and SVG animated props, set once
 * at mount); nothing re-renders per frame. The player's moving watermark is drawn ABOVE this
 * card, so a recording of the outro still names the viewer.
 */
export function CrestOutro({ teacher, gradeName, viewerName, code, onReplay, onBack }: {
  teacher: { name: string; subject?: string | null; logo_url?: string | null } | null;
  gradeName: string | null;
  viewerName: string | null;
  code: string;
  onReplay: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // The frame takes what the data block and the buttons leave (iPhone SE: ≈ 290 pt).
  const reserved = insets.top + 64 + 176 + 50 + insets.bottom + spacing.xl * 2;
  const size = Math.round(Math.max(220, Math.min(width - spacing.xl * 2, height - reserved, 330)));
  const g = useMemo(() => crestGeometry(size), [size]);
  const day = useMemo(() => watchedOn(new Date()), []);
  const sub = subjectLine(teacher?.subject, gradeName);
  const viewer = viewerLine(viewerName, code);

  const ring = useSharedValue(0);
  const disc = useSharedValue(0);
  const stems = useSharedValue(0);
  const leaves = useSharedValue(0);
  const medal = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const ribbon = useSharedValue(0);

  useEffect(() => {
    ring.value = withDelay(T.ring, withTiming(1, { duration: T.ringFor, easing: Easing.inOut(Easing.cubic) }));
    disc.value = withDelay(T.disc, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    stems.value = withDelay(T.stems, withTiming(1, { duration: T.stemsFor, easing: Easing.out(Easing.quad) }));
    leaves.value = withDelay(T.leaves, withTiming(LAUREL_STATIONS, { duration: LAUREL_STATIONS * T.leafEach, easing: Easing.linear }));
    medal.value = withDelay(T.medal, withSpring(1, { damping: 7, stiffness: 150, mass: 0.8 }));
    shimmer.value = withDelay(T.shimmer, withRepeat(withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }), 2, false));
    ribbon.value = withDelay(T.ribbon, withTiming(1, { duration: 560, easing: Easing.out(Easing.back(1.3)) }));
    return () => { [ring, disc, stems, leaves, medal, shimmer, ribbon].forEach((v) => cancelAnimation(v)); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: g.ringHalf * (1 - ring.value) }));
  const innerProps = useAnimatedProps(() => ({ strokeDashoffset: g.innerHalf * (1 - ring.value) }));
  const stemProps = useAnimatedProps(() => ({ strokeDashoffset: g.stemLength * (1 - stems.value) }));
  const discStyle = useAnimatedStyle(() => ({ opacity: disc.value, transform: [{ scale: interpolate(disc.value, [0, 1], [0.9, 1]) }] }));
  const medalStyle = useAnimatedStyle(() => ({
    opacity: interpolate(medal.value, [0, 0.15], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(medal.value, [0, 1], [-size * 0.32, 0]) }, { scale: interpolate(medal.value, [0, 1], [1.25, 1]) }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value > 0 && shimmer.value < 1 ? 1 : 0,
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-g.medallion, g.medallion]) }, { rotate: '22deg' }],
  }));
  const ribbonStyle = useAnimatedStyle(() => ({ opacity: interpolate(ribbon.value, [0, 0.2], [0, 1], Extrapolation.CLAMP), transform: [{ scaleX: Math.max(0.01, ribbon.value) }] }));

  const ribbonWidth = Math.min(size * 0.9, width - spacing.lg * 2);
  const titleSize = Math.round(size * 0.115);

  return (
    <Animated.View entering={FadeIn.duration(350)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      <LinearGradient colors={['rgba(7,11,34,0.9)', 'rgba(16,22,58,0.97)', 'rgba(6,9,28,0.99)']} style={{ flex: 1, alignItems: 'center', paddingTop: insets.top + 56 }}>
        {/* The frame */}
        <View style={{ width: size, height: size }}>
          {/* The navy disc */}
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: size, height: size }, discStyle]}>
            <Svg width={size} height={size}>
              <Defs>
                <RadialGradient id="disc" cx="50%" cy="36%" r="60%">
                  <Stop offset="0" stopColor="#3442A8" />
                  <Stop offset="0.6" stopColor={CREST_NAVY} />
                  <Stop offset="1" stopColor={CREST_NAVY_DEEP} />
                </RadialGradient>
              </Defs>
              <Circle cx={g.c} cy={g.c} r={g.disc} fill="url(#disc)" />
            </Svg>
          </Animated.View>

          {/* The gold rings and the stems, drawn up both sides from the bottom */}
          <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <SvgLinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={CREST_GOLD_LIGHT} />
                <Stop offset="0.5" stopColor={CREST_GOLD} />
                <Stop offset="1" stopColor={CREST_GOLD_DEEP} />
              </SvgLinearGradient>
            </Defs>
            {[g.ringLeft, g.ringRight].map((d) => (
              <AnimatedPath key={d} d={d} stroke="url(#gold)" strokeWidth={g.ringStroke} fill="none" strokeLinecap="round" strokeDasharray={`${g.ringHalf} ${g.ringHalf}`} animatedProps={ringProps} />
            ))}
            {[g.innerLeft, g.innerRight].map((d) => (
              <AnimatedPath key={d} d={d} stroke={CREST_GOLD} strokeOpacity={0.7} strokeWidth={1} fill="none" strokeDasharray={`${g.innerHalf} ${g.innerHalf}`} animatedProps={innerProps} />
            ))}
            {[g.stemLeft, g.stemRight].map((d) => (
              <AnimatedPath key={d} d={d} stroke={CREST_GOLD} strokeWidth={Math.max(1.4, size * 0.006)} fill="none" strokeLinecap="round" strokeDasharray={`${g.stemLength} ${g.stemLength}`} animatedProps={stemProps} />
            ))}
          </Svg>

          {/* The laurel, pair by pair */}
          {g.stations.map((st, i) => (
            <LeafPair key={i} g={g} station={st} index={i} progress={leaves} />
          ))}

          {/* Inside the disc: «حكاوي», the ribbon, the subject */}
          <View pointerEvents="none" style={{ position: 'absolute', left: g.c - g.disc, top: g.c - g.disc, width: g.disc * 2, height: g.disc * 2, alignItems: 'center', justifyContent: 'center', paddingTop: g.medallion * 0.35 }}>
            <Animated.Text entering={FadeInDown.delay(T.title).duration(420)} style={{ fontFamily: fonts.bold, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.45), color: CREST_GOLD_LIGHT, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8 }}>
              {t('threads.end_title')}
            </Animated.Text>
            <View style={{ width: ribbonWidth, alignItems: 'center', marginTop: 2 }}>
              <Animated.View style={[{ width: ribbonWidth }, ribbonStyle]}>
                <Ribbon width={ribbonWidth} name={teacher?.name ?? null} logo={teacher?.logo_url ?? null} />
              </Animated.View>
            </View>
            {sub ? (
              <Animated.Text entering={FadeIn.delay(T.subject).duration(400)} numberOfLines={1} style={{ maxWidth: g.disc * 1.6, marginTop: spacing.sm, fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.82)' }}>
                {sub}
              </Animated.Text>
            ) : null}
          </View>

          {/* The DS medallion lands on the ring's top */}
          <Animated.View style={[{ position: 'absolute', left: g.c - g.medallion / 2, top: g.c - g.ring - g.medallion / 2, width: g.medallion, height: g.medallion }, medalStyle]}>
            <View style={{ width: g.medallion, height: g.medallion, borderRadius: g.medallion / 2, overflow: 'hidden' }}>
              <CrestMedallion size={g.medallion} />
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -g.medallion * 0.3, left: g.medallion * 0.38, width: g.medallion * 0.24, height: g.medallion * 1.6 }, shimmerStyle]}>
                <LinearGradient colors={['rgba(255,240,200,0)', 'rgba(255,240,200,0.75)', 'rgba(255,240,200,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
              </Animated.View>
            </View>
          </Animated.View>
        </View>

        {/* The data block */}
        <View style={{ alignItems: 'center', gap: 5, marginTop: spacing.md, paddingHorizontal: spacing.lg }}>
          <Animated.View entering={FadeInDown.delay(T.data).duration(380)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="link" size={15} color={CREST_GOLD_LIGHT} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, letterSpacing: 0.6, color: CREST_GOLD_LIGHT, writingDirection: 'ltr' }}>{t('threads.end_site')}</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(T.data + 140).duration(380)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="download" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.88)' }}>{t('threads.end_app')}</Text>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(T.data + 300).duration(380)}>
            <GoldRule width={Math.min(200, width * 0.5)} />
          </Animated.View>
          {viewer ? (
            <Animated.Text entering={FadeIn.delay(T.data + 420).duration(380)} numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>
              {viewer}
            </Animated.Text>
          ) : null}
          <Animated.Text entering={FadeIn.delay(T.data + 540).duration(380)} style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            {t('threads.end_watched', { date: day })}
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(T.data + 660).duration(380)} style={{ fontFamily: fonts.regular, fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>
            {t('threads.end_rights')}
          </Animated.Text>
        </View>

        {/* Replay first (the start side), back beside it */}
        <Animated.View entering={FadeInDown.delay(T.buttons).duration(420)} style={{ position: 'absolute', bottom: insets.bottom + spacing.xl, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
          <TouchableOpacity onPress={onReplay} activeOpacity={0.85} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, height: 50, borderRadius: radius.full, backgroundColor: CREST_GOLD_LIGHT }}>
            <Icon name="replay" size={20} color={CREST_NAVY_DEEP} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: CREST_NAVY_DEEP }}>{t('threads.replay')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onBack} activeOpacity={0.85} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, height: 50, borderRadius: radius.full, borderWidth: 1.5, borderColor: 'rgba(243,217,139,0.6)' }}>
            {/* RTL: back points right. */}
            <Icon name="forward" size={18} color={CREST_GOLD_LIGHT} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: CREST_GOLD_LIGHT }}>{t('threads.end_back')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

/**
 * One station of the laurel on BOTH branches — its pair pops in together (scale from the stem,
 * a small overshoot). One shared value drives every station: station i plays over [i, i+1].
 */
const LeafPair = memo(function LeafPair({ g, station, index, progress }: { g: CrestGeometry; station: LeafStation; index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [index, index + 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [index, index + 0.6, index + 1], [0.2, 1.18, 1], Extrapolation.CLAMP) }],
  }));
  const { box, length, width } = g.leaf;
  const d = leafPath(box, length, width);
  const half = box / 2;
  const top = index === LAUREL_STATIONS - 1;
  const leaves = (tangent: number) => (
    <Svg width={box} height={box}>
      <G>
        {[tangent - LEAF_SPREAD, tangent + LEAF_SPREAD, ...(top ? [tangent] : [])].map((a) => (
          <G key={a} rotation={a} origin={`${half}, ${half}`}>
            <Path d={d} fill={CREST_GOLD} />
            <Path d={`M ${half} ${half} L ${half} ${half - length * 0.78}`} stroke={CREST_GOLD_DEEP} strokeWidth={0.8} strokeOpacity={0.7} />
          </G>
        ))}
        {top ? <Circle cx={half} cy={half} r={Math.max(1.4, width * 0.28)} fill={CREST_GOLD_LIGHT} /> : null}
      </G>
    </Svg>
  );
  return (
    <>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: station.x - half, top: station.y - half, width: box, height: box }, style]}>
        {leaves(station.tangent)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: g.size - station.x - half, top: station.y - half, width: box, height: box }, style]}>
        {leaves(-station.tangent)}
      </Animated.View>
    </>
  );
});

/**
 * The stamp's ribbon banner: a gold band with notched tails folded behind it, a fine navy
 * border inside, the teacher's name across it — and their logo, small, at its start when set.
 */
function Ribbon({ width, name, logo }: { width: number; name: string | null; logo: string | null }) {
  const [logoOk, setLogoOk] = useState(true);
  const H = 34;
  const drop = 7;
  const tail = 30;
  const inset = 16;
  const notch = 10;
  const showLogo = !!logo && logoOk;
  return (
    <View style={{ width, height: H + drop }}>
      <Svg width={width} height={H + drop} style={{ position: 'absolute' }}>
        <Defs>
          <SvgLinearGradient id="band" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={CREST_GOLD_LIGHT} />
            <Stop offset="1" stopColor={CREST_GOLD} />
          </SvgLinearGradient>
        </Defs>
        {/* Tails, behind */}
        <Polygon points={`0,${drop} ${tail},${drop} ${tail},${H + drop} 0,${H + drop} ${notch},${(H / 2) + drop}`} fill={CREST_GOLD_DEEP} />
        <Polygon points={`${width},${drop} ${width - tail},${drop} ${width - tail},${H + drop} ${width},${H + drop} ${width - notch},${(H / 2) + drop}`} fill={CREST_GOLD_DEEP} />
        {/* The folds */}
        <Polygon points={`${inset},${H} ${tail},${H + drop} ${tail},${H}`} fill="#5E480A" />
        <Polygon points={`${width - inset},${H} ${width - tail},${H + drop} ${width - tail},${H}`} fill="#5E480A" />
        {/* The band */}
        <Rect x={inset} y={0} width={width - inset * 2} height={H} fill="url(#band)" />
        <Rect x={inset + 3} y={3} width={width - inset * 2 - 6} height={H - 6} fill="none" stroke={CREST_NAVY_DEEP} strokeOpacity={0.55} strokeWidth={0.8} />
      </Svg>
      <View style={{ position: 'absolute', left: inset + 8, right: inset + 8, top: 0, height: H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {showLogo ? (
          <Image source={{ uri: logo! }} onError={() => setLogoOk(false)} contentFit="cover" style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: CREST_NAVY_DEEP, backgroundColor: '#FFFFFF' }} />
        ) : null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: CREST_NAVY_DEEP }}>
          {name ?? 'دروس سبوت'}
        </Text>
      </View>
    </View>
  );
}

/** A thin gold rule with a small diamond in the middle — the crest's divider. */
function GoldRule({ width }: { width: number }) {
  const c = width / 2;
  return (
    <Svg width={width} height={12}>
      <Path d={`M 0 6 L ${c - 9} 6 M ${c + 9} 6 L ${width} 6`} stroke={CREST_GOLD} strokeOpacity={0.6} strokeWidth={1} />
      <Polygon points={`${c},1 ${c + 5},6 ${c},11 ${c - 5},6`} fill={CREST_GOLD} />
    </Svg>
  );
}
