import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, ActivityIndicator, PanResponder, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PHOTO_CANVAS, PHOTO_INK, StrokeLayer, useImageSize } from './AnnotatedPhoto';
import {
  appendPoint, arrowPoints, containRect, ellipsePoints, isShape, normalisePoint, DEFAULT_STROKE_WIDTH, MAX_STROKES, STROKE_WIDTHS,
  type PhotoAnnotations, type Point, type Rect, type Stroke,
} from './annotationGeometry';
import type { IconName } from '@/components/ui/Icon';

/** Pens: red first (what a corrector circles with), then yellow, blue, black. */
const PEN_COLORS = ['#E53935', '#FDD835', '#1E88E5', '#111111'];
const INK_SOFT = 'rgba(255,255,255,0.72)';
const CHIP = 'rgba(255,255,255,0.12)';
const PANEL = 'rgba(255,255,255,0.07)';
const ACTIVE = 'rgba(255,255,255,0.22)';

/** Free drawing, a circle around an answer, or an arrow to a question. */
type Tool = 'pen' | 'circle' | 'arrow';
const TOOLS: { key: Tool; icon: IconName; label: string; rotate?: string }[] = [
  { key: 'pen', icon: 'brush', label: 'complaints.grade.tool_pen' },
  { key: 'circle', icon: 'shapeCircle', label: 'complaints.grade.tool_circle' },
  { key: 'arrow', icon: 'shapeArrow', label: 'complaints.grade.tool_arrow', rotate: '-45deg' },
];
/** Show what is left once the drawing gets close to the server's limit. */
const WARN_AT = MAX_STROKES - 10;

/**
 * «علِّم على الخطأ» — a full-screen editor over the photo of the exam paper (founder
 * 2026-10-05: «photo upload or taken and in-app editing»). Draw with a finger, pick a pen,
 * undo a line or clear them all, then «تم». The strokes are stored as fractions of the
 * IMAGE (not the screen), so the teacher sees them on the same spot of the paper.
 *
 * v2 (founder 2026-10-06: «the edit UI needs a little enhancing»): three tools — a free pen,
 * a circle and an arrow (both dragged, previewed live, stored as ordinary strokes) — three
 * thicknesses, and a toolbar in rows: tools, then colour and size, then undo and clear.
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
  const [tool, setTool] = useState<Tool>('pen');
  const [width, setWidth] = useState<number>(DEFAULT_STROKE_WIDTH);

  useEffect(() => {
    if (visible) { setStrokes(initial?.strokes ?? []); setCurrent(null); setColor(PEN_COLORS[0]); setTool('pen'); setWidth(DEFAULT_STROKE_WIDTH); }
    // Re-seeded each time the editor opens, from what was drawn before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rect: Rect | null = useMemo(
    () => (size && box ? containRect(size.width, size.height, box.w, box.h) : null),
    [size, box],
  );

  // The responder is made once; it reads the live values through refs.
  const live = useRef({ rect, color, strokes, tool: 'pen' as Tool, width: DEFAULT_STROKE_WIDTH, start: null as Point | null, current: null as Point[] | null });
  live.current.rect = rect;
  live.current.color = color;
  live.current.strokes = strokes;
  live.current.tool = tool;
  live.current.width = width;

  /** The shape a drag from the start to `p` makes with the current tool. */
  const shapeTo = (p: Point): Point[] => {
    const a = live.current.start ?? p;
    const r = live.current.rect;
    if (live.current.tool === 'circle') return ellipsePoints(a, p);
    return arrowPoints(a, p, r && r.height ? r.width / r.height : 1);
  };

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
      live.current.start = p;
      live.current.current = [p];
      setCurrent([p]);
    },
    onPanResponderMove: (e) => {
      const pts = live.current.current;
      const p = pointOf(e);
      if (!pts || !p) return;
      if (live.current.tool !== 'pen') {
        // A shape is redrawn from its starting point on every move: the preview IS the result.
        const shape = shapeTo(p);
        live.current.current = shape;
        setCurrent(shape);
        return;
      }
      const next = appendPoint(pts, p);
      if (next !== pts) { live.current.current = next; setCurrent(next); }
    },
    onPanResponderRelease: () => finish(),
    onPanResponderTerminate: () => finish(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  function finish() {
    const pts = live.current.current;
    const start = live.current.start;
    live.current.current = null;
    live.current.start = null;
    setCurrent(null);
    if (!pts?.length) return;
    // A shape needs a real drag; a tap with the circle or arrow tool is a slip, not a mark.
    if (live.current.tool !== 'pen' && (!start || pts.length < 2 || !isShape(start, live.current.tool === 'circle' ? pts[Math.floor(pts.length / 2)] : pts[1]))) return;
    setStrokes((s) => (s.length >= MAX_STROKES ? s : [...s, { color: live.current.color, width: live.current.width, points: pts }]));
  }

  const full = strokes.length >= MAX_STROKES;
  const left = MAX_STROKES - strokes.length;
  const hint = full ? t('complaints.grade.strokes_full') : tool === 'circle' ? t('complaints.grade.hint_circle') : tool === 'arrow' ? t('complaints.grade.hint_arrow') : t('complaints.grade.annotate_hint');

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
              {hint}
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
                <StrokeLayer strokes={strokes} rect={rect} current={current ? { color, width, points: current } : null} />
              </View>
            </View>
          )}
        </View>

        {/* The toolbar, in rows: what to draw · colour and thickness · undo and clear. */}
        <View style={{ marginHorizontal: spacing.md, marginTop: spacing.xs, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: PANEL, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {TOOLS.map((tl) => {
              const on = tl.key === tool;
              return (
                <TouchableOpacity key={tl.key} onPress={() => setTool(tl.key)} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ flex: 1, height: 44, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? ACTIVE : 'transparent' }}>
                  <Icon name={tl.icon} size={18} color={on ? PHOTO_INK : INK_SOFT} style={tl.rotate ? { transform: [{ rotate: tl.rotate }] } : undefined} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: on ? PHOTO_INK : INK_SOFT }}>{t(tl.label)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} accessibilityLabel={t('complaints.grade.pen')}>
              {PEN_COLORS.map((c) => {
                const on = c === color;
                return (
                  <TouchableOpacity key={c} onPress={() => setColor(c)} hitSlop={4} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? PHOTO_INK : 'transparent' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} accessibilityLabel={t('complaints.grade.size')}>
              {STROKE_WIDTHS.map((w, i) => {
                const on = w === width;
                const dot = 8 + i * 5;
                return (
                  <TouchableOpacity key={w} onPress={() => setWidth(w)} hitSlop={4} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? ACTIVE : 'transparent' }}>
                    <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity onPress={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, height: 42, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: CHIP, opacity: strokes.length ? 1 : 0.4 }}>
              <Icon name="undo" size={18} color={PHOTO_INK} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: PHOTO_INK }}>{t('complaints.grade.undo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStrokes([])} disabled={!strokes.length} activeOpacity={0.85} accessibilityRole="button"
              style={{ flex: 1, height: 42, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: CHIP, opacity: strokes.length ? 1 : 0.4 }}>
              <Icon name="trash" size={16} color={PHOTO_INK} outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: PHOTO_INK }}>{t('complaints.grade.clear')}</Text>
            </TouchableOpacity>
          </View>
          {strokes.length >= WARN_AT && !full ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: INK_SOFT, textAlign: 'center' }}>{t('complaints.grade.strokes_left', { n: left })}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
