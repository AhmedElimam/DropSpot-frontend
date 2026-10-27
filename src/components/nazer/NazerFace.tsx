import { memo, useEffect, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useAmbientMotion } from '@/hooks/useAmbientMotion';
import { NAZER_FRAME, NAZER_LAYERS, NAZER_MOODS, NAZER_PIVOTS, NAZER_PORTRAIT_160, NAZER_RIG_SCALE, type NazerLayer, type NazerMood, type NazerMove } from '@/nazer/manifest';

/**
 * الناظر صلاح الدين's face: the painted base with the mood's parts laid over it, each part
 * shifted, turned and scaled about its own pivot. A mood is a still picture; the only motion
 * is a blink or two after the face appears (short bursts on timers, like RoseLive — never a
 * loop), and only while the screen is in front and the phone allows motion.
 */
export const NazerFace = memo(function NazerFace({ mood = 'neutral', size = 72, blink = true, style }: {
  mood?: NazerMood;
  size?: number;
  blink?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Under 56 pt the parts are a few pixels each: the flat portrait reads better and costs one draw.
  if (size < 56) {
    return <Image source={NAZER_PORTRAIT_160} style={[{ width: size, height: size }, style as object]} contentFit="contain" accessibilityLabel="الناظر صلاح الدين" />;
  }
  const k = size / NAZER_FRAME;
  const recipe = NAZER_MOODS[mood];
  const eyesOpen = !('lid_happy_l' in recipe);
  return (
    // direction 'ltr': the app forces RTL, which turns `left` into `start`; his parts are placed on physical edges.
    <View style={[{ width: size, height: size, direction: 'ltr' }, style]} accessibilityRole="image" accessibilityLabel="الناظر صلاح الدين">
      <Image source={NAZER_LAYERS.base.source} style={StyleSheet.absoluteFill} contentFit="fill" />
      {(Object.keys(recipe) as NazerLayer[]).map((name) => (
        <Part key={name} name={name} move={recipe[name] ?? {}} k={k} />
      ))}
      {blink && eyesOpen ? <Blinker k={k} /> : null}
    </View>
  );
});

function Part({ name, move, k: frameK }: { name: NazerLayer; move: NazerMove; k: number }) {
  const l = NAZER_LAYERS[name];
  const pivot = NAZER_PIVOTS[name] ?? [l.x + l.w / 2, l.y + l.h / 2];
  // The base is his figure grown ×NAZER_RIG_SCALE about the centre: every part grows with it.
  const k = frameK * NAZER_RIG_SCALE;
  const shift = (NAZER_FRAME / 2) * frameK * (1 - NAZER_RIG_SCALE);
  // Turn and grow about the pivot: step to it, transform, step back (RN applies the list right to left).
  // The manifest's `rot` is counter-clockwise, as the rig's preview tool draws it; RN turns clockwise.
  const ox = (pivot[0] - (l.x + l.w / 2)) * k;
  const oy = (pivot[1] - (l.y + l.h / 2)) * k;
  const transform = [
    { translateX: (move.dx ?? 0) * k + ox },
    { translateY: (move.dy ?? 0) * k + oy },
    { rotate: `${-(move.rot ?? 0)}deg` },
    { scale: move.scale ?? 1 },
    { translateX: -ox },
    { translateY: -oy },
  ];
  return (
    <Image
      source={l.source}
      style={{ position: 'absolute', left: shift + l.x * k, top: shift + l.y * k, width: l.w * k, height: l.h * k, transform }}
      contentFit="fill"
    />
  );
}

/** Two blinks after the face appears, then stillness. Mounted only when the eyes are open. */
function Blinker({ k }: { k: number }) {
  const alive = useAmbientMotion();
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!alive) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const blinkAt = (ms: number) => {
      timers.push(setTimeout(() => {
        setClosed(true);
        timers.push(setTimeout(() => setClosed(false), 130));
      }, ms));
    };
    blinkAt(1400);
    blinkAt(5200);
    return () => {
      timers.forEach(clearTimeout);
      setClosed(false);
    };
  }, [alive]);
  if (!closed) return null;
  return (
    <>
      <Part name="lid_blink_l" move={{}} k={k} />
      <Part name="lid_blink_r" move={{}} k={k} />
    </>
  );
}
