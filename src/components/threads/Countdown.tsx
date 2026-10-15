import { memo, useEffect, useRef, useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';
import { fractionLeft, humanLeft, quantize, ringParts, secondsUntil } from './format';

export { secondsUntil } from './format';

/**
 * حكاوي's clock. ONE shared one-second timer feeds every countdown on screen (a feed of ten
 * open rounds is one interval, not ten), and each countdown re-renders only when its
 * rounded value changes — every second in the last hour, every half minute within the day,
 * every five minutes beyond (format.ts → quantize). Nothing above the countdown re-renders:
 * the card, the feed and the screen never see the tick.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}

/** Seconds to `endsAt`, rounded to what the label can show; `onElapsed` fires once at zero. */
export function useSecondsLeft(endsAt: string | null, onElapsed?: () => void): number {
  const [left, setLeft] = useState(() => (endsAt ? quantize(secondsUntil(endsAt)) : 0));
  const elapsed = useRef(onElapsed);
  elapsed.current = onElapsed;

  useEffect(() => {
    if (!endsAt) return;
    let fired = false;
    const read = () => {
      const s = secondsUntil(endsAt);
      setLeft(quantize(s)); // same value → React bails out, no render
      if (s <= 0 && !fired) { fired = true; elapsed.current?.(); }
    };
    read();
    return subscribe(read);
  }, [endsAt]);

  return left;
}

/** «فاضل …» in words; ticks itself. */
export const Countdown = memo(function Countdown({ endsAt, style, onElapsed, prefix }: {
  endsAt: string; style?: TextStyle; onElapsed?: () => void; prefix?: string;
}) {
  const left = useSecondsLeft(endsAt, onElapsed);
  return (
    <Text style={[{ fontFamily: fonts.bold, fontVariant: ['tabular-nums'] }, style]} numberOfLines={1}>
      {prefix ? `${prefix} ` : ''}{humanLeft(left)}
    </Text>
  );
});

/**
 * A slim bar that drains as the round runs out. It moves only on the clock's rounded steps,
 * each step eased over a moment on the UI thread — no endless animation, so a long feed does
 * not keep the GPU busy (Android commits every animated frame).
 */
export const TimerBar = memo(function TimerBar({ createdAt, endsAt, color, track, height = 6 }: {
  createdAt: string; endsAt: string; color: string; track: string; height?: number;
}) {
  const left = useSecondsLeft(endsAt);
  const share = useSharedValue(fractionLeft(createdAt, endsAt));
  useEffect(() => {
    share.value = withTiming(fractionLeft(createdAt, endsAt), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [left, createdAt, endsAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(3, share.value * 100)}%` as const }));
  const urgent = left > 0 && left <= 600;

  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: urgent ? colors.danger : color }, fill]} />
    </View>
  );
});

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The thread screen's big clock: a ring that empties with the round, the figure and its unit
 * in the middle. Same stepping as the bar.
 */
export const CountdownRing = memo(function CountdownRing({ createdAt, endsAt, size = 92, stroke = 7, color, track, ink, soft, onElapsed }: {
  createdAt: string; endsAt: string; size?: number; stroke?: number; color: string; track: string; ink: string; soft: string; onElapsed?: () => void;
}) {
  const left = useSecondsLeft(endsAt, onElapsed);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const share = useSharedValue(fractionLeft(createdAt, endsAt));
  useEffect(() => {
    share.value = withTiming(fractionLeft(createdAt, endsAt), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [left, createdAt, endsAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const arc = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - Math.max(0.02, share.value)) }));
  const parts = ringParts(left);
  const urgent = left > 0 && left <= 600;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke={urgent ? colors.danger : color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`} animatedProps={arc}
        />
      </Svg>
      <Text style={{ fontFamily: fonts.bold, fontSize: parts.value.length > 3 ? 17 : 24, lineHeight: parts.value.length > 3 ? 22 : 28, color: urgent ? colors.danger : ink, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {parts.value}
      </Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: soft }} numberOfLines={1}>{parts.unit}</Text>
    </View>
  );
});
