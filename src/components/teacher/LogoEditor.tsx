import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import * as ImageManipulator from 'expo-image-manipulator';
import { AppModal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/** A picture ready for the editor: on this phone, upright, its real pixel size. */
export type EditorPicture = { uri: string; width: number; height: number; png: boolean };

/** What the editor hands back: the (rotated) picture and the square to keep, in its pixels. */
export type LogoEdit = { uri: string; png: boolean; crop: { x: number; y: number; size: number }; background: string };

/** Fills the square where the logo does not reach (a wide logo fitted whole). */
const BACKGROUNDS: { key: string; value: string; swatch: string }[] = [
  { key: 'white', value: '#ffffff', swatch: '#ffffff' },
  { key: 'black', value: '#000000', swatch: '#000000' },
  { key: 'navy', value: '#34419b', swatch: '#34419b' },
  { key: 'none', value: 'transparent', swatch: 'transparent' },
];

const MAX_ZOOM = 6;
const MAX_SIDE = 1600;

/**
 * Picks up a picture from the library as the editor wants it: upright (the phone's orientation
 * baked in) and at most MAX_SIDE px — the server draws the final square, at most 1024 px.
 */
export async function prepareForEditor(asset: { uri: string; width?: number; height?: number; mimeType?: string | null }): Promise<EditorPicture> {
  const png = (asset.mimeType ?? asset.uri).toLowerCase().includes('png');
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  const resize = Math.max(w, h) > MAX_SIDE ? [{ resize: w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
  const out = await ImageManipulator.manipulateAsync(asset.uri, resize, {
    compress: 0.9,
    format: png ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height, png };
}

/**
 * The teacher's logo editor (founder 2026-11-08: «like a profile picture on social media»). Drag to
 * move, pinch to zoom, double tap for fit-whole ↔ fill, a quarter turn at a time. A logo far from
 * square opens fitted whole on a background (a crop would cut its words); a photo opens filling the
 * circle. Under the frame, the logo as parents see it: in the round, and in the rounded square.
 */
export function LogoEditor({ picture, onCancel, onDone }: {
  picture: EditorPicture | null;
  onCancel: () => void;
  onDone: (edit: LogoEdit) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const F = Math.min(screenW - 2 * spacing.xl, 340);

  const [turns, setTurns] = useState(0);
  const [bg, setBg] = useState(BACKGROUNDS[0].value);
  const [busy, setBusy] = useState(false);

  const z = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const z0 = useSharedValue(1);
  const tx0 = useSharedValue(0);
  const ty0 = useSharedValue(0);

  const w = picture?.width ?? 1;
  const h = picture?.height ?? 1;
  const rw = turns % 2 ? h : w;
  const rh = turns % 2 ? w : h;
  const s0 = Math.max(F / rw, F / rh); // fills the frame at zoom 1
  const zMin = Math.min(F / rw, F / rh) / s0; // the whole logo inside the frame

  // A new picture: a logo far from square starts fitted whole, a photo starts filling.
  useEffect(() => {
    if (!picture) return;
    setTurns(0);
    setBg(picture.png ? 'transparent' : BACKGROUNDS[0].value);
    const ratio = Math.max(picture.width, picture.height) / Math.min(picture.width, picture.height);
    z.value = ratio >= 1.25 ? Math.min(picture.width, picture.height) / Math.max(picture.width, picture.height) : 1;
    tx.value = 0;
    ty.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picture?.uri]);

  const bounds = useMemo(() => ({ F, s0, rw, rh, zMin }), [F, s0, rw, rh, zMin]);

  const pinch = Gesture.Pinch()
    .onStart(() => { z0.value = z.value; })
    .onUpdate((e) => {
      'worklet';
      const next = Math.min(MAX_ZOOM, Math.max(bounds.zMin, z0.value * e.scale));
      z.value = next;
      tx.value = clampT(tx.value, bounds.rw * bounds.s0 * next, bounds.F);
      ty.value = clampT(ty.value, bounds.rh * bounds.s0 * next, bounds.F);
    });
  const pan = Gesture.Pan()
    .onStart(() => { tx0.value = tx.value; ty0.value = ty.value; })
    .onUpdate((e) => {
      'worklet';
      tx.value = clampT(tx0.value + e.translationX, bounds.rw * bounds.s0 * z.value, bounds.F);
      ty.value = clampT(ty0.value + e.translationY, bounds.rh * bounds.s0 * z.value, bounds.F);
    });
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    'worklet';
    const toFit = z.value > bounds.zMin + 0.01;
    z.value = withTiming(toFit ? bounds.zMin : 1, { duration: 180 });
    tx.value = withTiming(0, { duration: 180 });
    ty.value = withTiming(0, { duration: 180 });
  });
  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const fit = () => { z.value = withTiming(zMin, { duration: 180 }); tx.value = withTiming(0, { duration: 180 }); ty.value = withTiming(0, { duration: 180 }); };
  const fill = () => { z.value = withTiming(1, { duration: 180 }); tx.value = withTiming(0, { duration: 180 }); ty.value = withTiming(0, { duration: 180 }); };
  const rotate = () => {
    // A quarter turn swaps the sides: start again from the same choice (fit or fill), centred.
    const fitted = z.value <= zMin + 0.01;
    const next = (turns + 1) % 4;
    setTurns(next);
    const nrw = next % 2 ? h : w;
    const nrh = next % 2 ? w : h;
    z.value = fitted ? Math.min(F / nrw, F / nrh) / Math.max(F / nrw, F / nrh) : 1;
    tx.value = 0;
    ty.value = 0;
  };

  const done = async () => {
    if (!picture || busy) return;
    setBusy(true);
    try {
      const scale = s0 * z.value;
      const size = F / scale;
      const cx = rw / 2 - tx.value / scale;
      const cy = rh / 2 - ty.value / scale;
      let uri = picture.uri;
      if (turns) {
        const out = await ImageManipulator.manipulateAsync(picture.uri, [{ rotate: turns * 90 }], {
          compress: 0.9,
          format: picture.png ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
        });
        uri = out.uri;
      }
      await onDone({ uri, png: picture.png, crop: { x: cx - size / 2, y: cy - size / 2, size }, background: bg });
    } finally {
      setBusy(false);
    }
  };

  const canvasH = F + 2 * spacing.xl;

  return (
    <AppModal visible={!!picture} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0d0f1a' }}>
        {/* Top bar: cancel · title · save */}
        <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={onCancel} disabled={busy} hitSlop={10} accessibilityRole="button" style={{ minWidth: 64 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{t('logo_editor.title')}</Text>
          <TouchableOpacity onPress={done} disabled={busy} hitSlop={10} accessibilityRole="button" style={{ minWidth: 64, alignItems: 'flex-end' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#8FA2FF' }}>{t('logo_editor.save')}</Text>}
          </TouchableOpacity>
        </View>

        {/* The canvas: the picture moves under a round window; outside it, dimmed. */}
        <GestureDetector gesture={gesture}>
          <View style={{ width: screenW, height: canvasH, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', width: F, height: F, borderRadius: F / 2, backgroundColor: bg === 'transparent' ? '#2a2d3d' : bg }} />
            {picture ? <Stage picture={picture} k={1} F={F} s0={s0} turns={turns} z={z} tx={tx} ty={ty} /> : null}
            <Svg width={screenW} height={canvasH} style={{ position: 'absolute' }} pointerEvents="none">
              <Path
                d={`M0 0H${screenW}V${canvasH}H0Z M${screenW / 2 - F / 2} ${canvasH / 2} a${F / 2} ${F / 2} 0 1 0 ${F} 0 a${F / 2} ${F / 2} 0 1 0 ${-F} 0Z`}
                fill="rgba(5,7,15,0.62)" fillRule="evenodd" />
              <Circle cx={screenW / 2} cy={canvasH / 2} r={F / 2} stroke="rgba(255,255,255,0.9)" strokeWidth={2} fill="none" />
            </Svg>
          </View>
        </GestureDetector>

        <Text style={{ textAlign: 'center', fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
          {t('logo_editor.hint')}
        </Text>

        {/* Tools: fit whole · fill · a quarter turn */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md }}>
          <Tool icon="image" label={t('logo_editor.fit')} onPress={fit} />
          <Tool icon="add" label={t('logo_editor.fill')} onPress={fill} />
          <Tool icon="redo" label={t('logo_editor.rotate')} onPress={rotate} />
        </View>

        {/* Background — what fills the circle where the logo does not reach. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.lg }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{t('logo_editor.background')}</Text>
          {BACKGROUNDS.map((b) => {
            const on = bg === b.value;
            return (
              <TouchableOpacity key={b.key} onPress={() => setBg(b.value)} accessibilityRole="button" accessibilityLabel={t(`logo_editor.bg_${b.key}`)} accessibilityState={{ selected: on }}
                style={{ width: 34, height: 34, borderRadius: 17, borderWidth: on ? 3 : 1, borderColor: on ? '#8FA2FF' : 'rgba(255,255,255,0.35)', backgroundColor: b.swatch === 'transparent' ? 'transparent' : b.swatch, alignItems: 'center', justifyContent: 'center' }}>
                {b.swatch === 'transparent' ? <Icon name="close" size={14} color="rgba(255,255,255,0.7)" /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* How parents see it: in the round (the profile) and in the rounded square (the lists). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.xl }}>
          <Preview picture={picture} size={64} round F={F} s0={s0} turns={turns} z={z} tx={tx} ty={ty} bg={bg} />
          <Preview picture={picture} size={44} round={false} F={F} s0={s0} turns={turns} z={z} tx={tx} ty={ty} bg={bg} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)', maxWidth: 140 }}>{t('logo_editor.preview')}</Text>
        </View>
      </GestureHandlerRootView>
    </AppModal>
  );
}

/** Keeps the frame covered when the picture is bigger than it, and the picture inside when smaller. */
function clampT(t: number, shown: number, F: number): number {
  'worklet';
  const lim = Math.abs(shown - F) / 2;
  return Math.min(lim, Math.max(-lim, t));
}

/** The picture, centred in a box of side F·k, moved / zoomed / turned as in the editor. */
function Stage({ picture, k, F, s0, turns, z, tx, ty }: {
  picture: EditorPicture; k: number; F: number; s0: number; turns: number;
  z: SharedValue<number>; tx: SharedValue<number>; ty: SharedValue<number>;
}) {
  const bw = picture.width * s0 * k;
  const bh = picture.height * s0 * k;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value * k }, { translateY: ty.value * k }, { scale: z.value }, { rotate: `${turns * 90}deg` }],
  }));
  return (
    // Centred by the parent's flex centring (an absolute child with no insets), not left/top: an
    // RTL layout mirrors left/right, transforms are not.
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: bw, height: bh }, style]}>
      <Image source={{ uri: picture.uri }} style={{ width: bw, height: bh }} contentFit="fill" />
    </Animated.View>
  );
}

function Preview({ picture, size, round, F, s0, turns, z, tx, ty, bg }: {
  picture: EditorPicture | null; size: number; round: boolean; F: number; s0: number; turns: number;
  z: SharedValue<number>; tx: SharedValue<number>; ty: SharedValue<number>; bg: string;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', borderRadius: round ? size / 2 : Math.round(size * 0.25), overflow: 'hidden', backgroundColor: bg === 'transparent' ? colors.surfaceSunken : bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
      {picture ? <Stage picture={picture} k={size / F} F={F} s0={s0} turns={turns} z={z} tx={tx} ty={ty} /> : null}
    </View>
  );
}

function Tool({ icon, label, onPress }: { icon: 'image' | 'add' | 'redo'; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', minHeight: 40 }}>
      <Icon name={icon} size={16} color="#fff" />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{label}</Text>
    </TouchableOpacity>
  );
}
