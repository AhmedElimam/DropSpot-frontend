import { View, Text, ActivityIndicator, Dimensions, type ViewStyle } from 'react-native';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * The camera's aiming frame — vignette, corner brackets, a hint pill — and the gate that
 * accepts a code only when its centre is inside it. Shared by the door scanner and
 * «ربط كارت المدرّس» (founder 2026-11-05: the link camera had no focus box).
 */

// A framed aiming target with bright corner brackets so there's an obvious spot
// to line the student's QR card up against (a plain rectangle read as "nothing to
// aim for"). One bracket per corner; the box itself keeps a faint full outline.
export const BRACKET = 38;
export const STROKE = 4;
export function bracket(pos: 'tl' | 'tr' | 'bl' | 'br'): ViewStyle {
  const s: ViewStyle = { position: 'absolute', width: BRACKET, height: BRACKET, borderColor: '#fff' };
  if (pos === 'tl') return { ...s, top: -STROKE, left: -STROKE, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: 22 };
  if (pos === 'tr') return { ...s, top: -STROKE, right: -STROKE, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: 22 };
  if (pos === 'bl') return { ...s, bottom: -STROKE, left: -STROKE, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: 22 };
  return { ...s, bottom: -STROKE, right: -STROKE, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: 22 };
}

// The aiming frame (must match the on-screen box in the render) plus slack, so a
// card only registers when it's lined up INSIDE the frame — not read from anywhere
// in view.
// Square (founder 2026-10-11: «it looks rectangular»): a card's QR is square and so is the box.
export const FRAME_W = 240;
export const FRAME_H = 240;
export const FRAME_SLACK = 56;
export const WIN_W = Dimensions.get('window').width;
export const WIN_H = Dimensions.get('window').height;
/** The shade outside the aiming box — still, cheap, and it makes the box the bright part. */
export const VIGNETTE = 'rgba(0,0,0,0.42)';

export type Pt = { x: number; y: number };

// Centre of a scanned barcode in view coordinates, from whichever geometry the
// platform reports. Returns null when neither bounds nor cornerPoints are present —
// the caller then can't gate and accepts the read, so scanning never breaks.
export function scanCentre(
  bounds?: { origin?: Pt; size?: { width: number; height: number } },
  corners?: Pt[],
): Pt | null {
  if (bounds?.origin && bounds.size && (bounds.size.width > 0 || bounds.size.height > 0)) {
    return { x: bounds.origin.x + bounds.size.width / 2, y: bounds.origin.y + bounds.size.height / 2 };
  }
  if (corners && corners.length > 0) {
    const n = corners.length;
    return { x: corners.reduce((s, p) => s + p.x, 0) / n, y: corners.reduce((s, p) => s + p.y, 0) / n };
  }
  return null;
}

/**
 * Is this read OUTSIDE the aiming frame? Only when the platform's geometry is trustworthy:
 * several Samsung/Android devices report it in camera-sensor pixels, and gating on those
 * would drop every read, so a centre off the screen is not trusted and the read is accepted.
 */
export function outsideFrame(bounds?: { origin?: Pt; size?: { width: number; height: number } }, corners?: Pt[]): boolean {
  const centre = scanCentre(bounds, corners);
  if (!centre) return false;
  const win = Dimensions.get('window');
  const trusted = centre.x >= 0 && centre.y >= 0 && centre.x <= win.width && centre.y <= win.height;
  return trusted
    && (Math.abs(centre.x - win.width / 2) > FRAME_W / 2 + FRAME_SLACK
      || Math.abs(centre.y - win.height / 2) > FRAME_H / 2 + FRAME_SLACK);
}

/** The frame itself, centred on the screen; the box is where the scanner reads (FRAME_W/H). */
export function ScanFrame({ tint = '#FFFFFF', icon = 'card', label, busy = false }: { tint?: string; icon?: IconName; label: string; busy?: boolean }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (WIN_H - FRAME_H) / 2, backgroundColor: VIGNETTE }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: (WIN_H - FRAME_H) / 2, backgroundColor: VIGNETTE }} />
      <View style={{ position: 'absolute', left: 0, top: (WIN_H - FRAME_H) / 2, width: (WIN_W - FRAME_W) / 2, height: FRAME_H, backgroundColor: VIGNETTE }} />
      <View style={{ position: 'absolute', right: 0, top: (WIN_H - FRAME_H) / 2, width: (WIN_W - FRAME_W) / 2, height: FRAME_H, backgroundColor: VIGNETTE }} />
      <View style={{ width: FRAME_W, height: FRAME_H, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
        <View style={[bracket('tl'), { borderColor: tint }]} />
        <View style={[bracket('tr'), { borderColor: tint }]} />
        <View style={[bracket('bl'), { borderColor: tint }]} />
        <View style={[bracket('br'), { borderColor: tint }]} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xl, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(13,18,48,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name={icon} size={16} color={tint} />}
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: '#fff', textAlign: 'center' }}>{label}</Text>
      </View>
    </View>
  );
}
