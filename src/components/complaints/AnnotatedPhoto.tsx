import { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, Modal, ActivityIndicator, TouchableOpacity, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { containRect, strokePath, strokeWidthPx, type PhotoAnnotations, type Point, type Rect, type Stroke } from './annotationGeometry';

/** The photo editor and viewer sit on a fixed dark canvas in both schemes, like any photo app. */
export const PHOTO_CANVAS = '#0E1116';
export const PHOTO_INK = '#FFFFFF';

/**
 * The family's drawing, as SVG over an image drawn in `rect` (its own box: 0,0 → width,height).
 * `current` is a line still under the finger (the annotator only).
 */
export const StrokeLayer = memo(function StrokeLayer({ strokes, rect, current }: {
  strokes: Stroke[]; rect: Rect; current?: { color: string; width: number; points: Point[] } | null;
}) {
  const box = { x: 0, y: 0, width: rect.width, height: rect.height };
  const paths = useMemo(
    () => strokes.map((s) => ({ d: strokePath(s.points, box), color: s.color, w: strokeWidthPx(s.width, box) })),
    // `box` is derived from the two numbers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strokes, rect.width, rect.height],
  );
  return (
    <Svg width={rect.width} height={rect.height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {paths.map((p, i) => (
        <Path key={i} d={p.d} stroke={p.color} strokeWidth={p.w} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
      ))}
      {current && current.points.length ? (
        <Path d={strokePath(current.points, box)} stroke={current.color} strokeWidth={strokeWidthPx(current.width, box)} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
      ) : null}
    </Svg>
  );
});

/** A photo fitted («contain») into a `boxW × boxH` box, with the drawing over the image itself. */
function FittedPhoto({ uri, size, strokes, boxW, boxH }: {
  uri: string; size: { width: number; height: number }; strokes: Stroke[]; boxW: number; boxH: number;
}) {
  const rect = containRect(size.width, size.height, boxW, boxH);
  if (!rect.width) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
      <Image source={{ uri }} style={{ width: rect.width, height: rect.height }} resizeMode="stretch" />
      <StrokeLayer strokes={strokes} rect={rect} />
    </View>
  );
}

/**
 * The image's real size: given (the picker reports it) or asked of the image itself (a
 * signed server link). `failed` when it cannot be loaded — an expired link, no network.
 */
export function useImageSize(uri: string | null | undefined, known?: { width: number; height: number } | null) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(known ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (known?.width && known?.height) { setSize(known); return; }
    setSize(null);
    if (!uri) return;
    let alive = true;
    Image.getSize(uri, (width, height) => { if (alive) setSize({ width, height }); }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
    // `known` is compared by its numbers, not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, known?.width, known?.height]);
  return { size, failed };
}

/**
 * The exam-paper photo with the family's marks on it (founder 2026-10-05). A thumbnail in
 * a list or sheet; a tap opens it full screen on a dark canvas. Strokes are stored as
 * fractions of the image, so they land on the same spot of the paper at any size.
 */
export function AnnotatedPhoto({ uri, annotations, imageSize, height = 180, style }: {
  uri: string;
  annotations?: PhotoAnnotations | null;
  /** The picker's width/height when known; otherwise read from the image. */
  imageSize?: { width: number; height: number } | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const { size, failed } = useImageSize(uri, imageSize);
  const [boxW, setBoxW] = useState(0);
  const [open, setOpen] = useState(false);
  const strokes = annotations?.strokes ?? [];

  const headerH = 56;
  const viewerW = win.width;
  const viewerH = win.height - insets.top - insets.bottom - headerH;

  return (
    <>
      <Pressable
        onPress={() => size && setOpen(true)}
        onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
        accessibilityRole="imagebutton"
        accessibilityLabel={t('complaints.grade.photo_open')}
        style={[{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }, style]}
      >
        {failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="image" size={26} color={colors.textTertiary} outline />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('complaints.grade.photo_failed')}</Text>
          </View>
        ) : !size || !boxW ? (
          <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
        ) : (
          <>
            <FittedPhoto uri={uri} size={size} strokes={strokes} boxW={boxW - 2} boxH={height - 2} />
            <View style={{ position: 'absolute', bottom: 8, start: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="eye" size={16} color={PHOTO_INK} />
            </View>
          </>
        )}
      </Pressable>

      <Modal visible={open} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: PHOTO_CANVAS, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={{ height: headerH, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }}>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Icon name="close" size={24} color={PHOTO_INK} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            {size ? <FittedPhoto uri={uri} size={size} strokes={strokes} boxW={viewerW} boxH={viewerH} /> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
