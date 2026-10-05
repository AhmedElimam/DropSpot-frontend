import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, ActivityIndicator, PanResponder, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PHOTO_CANVAS, PHOTO_INK, StrokeLayer, useImageSize } from './AnnotatedPhoto';
import {
  appendPoint, containRect, normalisePoint, DEFAULT_STROKE_WIDTH, MAX_STROKES,
  type PhotoAnnotations, type Point, type Rect, type Stroke,
} from './annotationGeometry';

/** Pens: red first (what a corrector circles with), then yellow, blue, black. */
const PEN_COLORS = ['#E53935', '#FDD835', '#1E88E5', '#111111'];
const INK_SOFT = 'rgba(255,255,255,0.72)';
const CHIP = 'rgba(255,255,255,0.12)';

/**
 * «علِّم على الخطأ» — a full-screen editor over the photo of the exam paper (founder
 * 2026-10-05: «photo upload or taken and in-app editing»). Draw with a finger, pick a pen,
 * undo a line or clear them all, then «تم». The strokes are stored as fractions of the
 * IMAGE (not the screen), so the teacher sees them on the same spot of the paper.
 *
 * Touches go through a PanResponder on the image's own rect: a plain RN responder works
 * the same inside this Modal on both platforms, with no gesture-handler root to mount.
 */
export function PhotoAnnotator({ visible, uri, imageSize, initial, onCancel, onDone }: {
  visible: boolean;
  uri: string | null;
  /** The picker's width/height (after any crop); read from the image when absent. */
  imageSize?: { width: number; height: number } | null;
  initial?: PhotoAnnotations | null;
  onCancel: () => void;
  onDone: (annotations: PhotoAnnotations) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { size } = useImageSize(uri, imageSize);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [current, setCurrent] = useState<Point[] | null>(null);

  useEffect(() => {
    if (visible) { setStrokes(initial?.strokes ?? []); setCurrent(null); setColor(PEN_COLORS[0]); }
    // Re-seeded each time the editor opens, from what was drawn before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rect: Rect | null = useMemo(
    () => (size && box ? containRect(size.width, size.height, box.w, box.h) : null),
    [size, box],
  );

  // The responder is made once; it reads the live values through refs.
  const live = useRef({ rect, color, strokes, current: null as Point[] | null });
  live.current.rect = rect;
  live.current.color = color;
  live.current.strokes = strokes;

  const pointOf = (e: GestureResponderEvent): Point | null => {
    const r = live.current.rect;
    if (!r) return null;
    // locationX/Y are relative to the drawing surface, which IS the image rect.
    return normalisePoint(e.nativeEvent.locationX, e.nativeEvent.locationY, { x: 0, y: 0, width: r.width, height: r.height });
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => live.current.strokes.length < MAX_STROKES,
    onMoveShouldSetPanResponder: () => live.current.strokes.length < MAX_STROKES,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => {
      const p = pointOf(e);
      if (!p) return;
      live.current.current = [p];
      setCurrent([p]);
    },
    onPanResponderMove: (e) => {
      const pts = live.current.current;
      const p = pointOf(e);
      if (!pts || !p) return;
      const next = appendPoint(pts, p);
      if (next !== pts) { live.current.current = next; setCurrent(next); }
    },
    onPanResponderRelease: () => finish(),
    onPanResponderTerminate: () => finish(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  function finish() {
    const pts = live.current.current;
    live.current.current = null;
    setCurrent(null);
    if (!pts?.length) return;
    setStrokes((s) => (s.length >= MAX_STROKES ? s : [...s, { color: live.current.color, width: DEFAULT_STROKE_WIDTH, points: pts }]));
  }

  const full = strokes.length >= MAX_STROKES;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: PHOTO_CANVAS, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.sm }}>
        {/* Header: close · title · «تم» */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <TouchableOpacity onPress={onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: CHIP }}>
            <Icon name="close" size={24} color={PHOTO_INK} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: PHOTO_INK }}>{t('complaints.grade.annotate_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: INK_SOFT, marginTop: 2 }} numberOfLines={2}>
              {full ? t('complaints.grade.strokes_full') : t('complaints.grade.annotate_hint')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onDone({ strokes })} activeOpacity={0.85} accessibilityRole="button"
            style={{ minWidth: 72, height: 44, paddingHorizontal: spacing.lg, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E53935' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' }}>{t('complaints.grade.done')}</Text>
          </TouchableOpacity>
        </View>

        {/* The paper, fitted, with the drawing surface exactly over the image. */}
        <View style={{ flex: 1, margin: spacing.sm }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {!uri || !rect || !rect.width ? (
            <ActivityIndicator color={PHOTO_INK} style={{ flex: 1 }} />
          ) : (
            <View {...responder.panHandlers} style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: rect.width, height: rect.height }}>
                <Image source={{ uri }} style={{ width: rect.width, height: rect.height }} resizeMode="stretch" />
                <StrokeLayer strokes={strokes} rect={rect} current={current ? { color, width: DEFAULT_STROKE_WIDTH, points: current } : null} />
              </View>
            </View>
          )}
        </View>

        {/* Pens · undo · clear */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }} accessibilityLabel={t('complaints.grade.pen')}>
            {PEN_COLORS.map((c) => {
              const on = c === color;
              return (
                <TouchableOpacity key={c} onPress={() => setColor(c)} hitSlop={6} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? PHOTO_INK : 'transparent' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }} />
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity onPress={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length} activeOpacity={0.85} accessibilityRole="button"
            style={{ height: 40, paddingHorizontal: spacing.md, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CHIP, opacity: strokes.length ? 1 : 0.4 }}>
            <Icon name="undo" size={18} color={PHOTO_INK} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: PHOTO_INK }}>{t('complaints.grade.undo')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStrokes([])} disabled={!strokes.length} activeOpacity={0.85} accessibilityRole="button"
            style={{ height: 40, paddingHorizontal: spacing.md, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CHIP, opacity: strokes.length ? 1 : 0.4 }}>
            <Icon name="trash" size={16} color={PHOTO_INK} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: PHOTO_INK }}>{t('complaints.grade.clear')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
