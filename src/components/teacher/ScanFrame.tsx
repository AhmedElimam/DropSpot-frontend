import { useState } from 'react';
import { View, Text, ActivityIndicator, Dimensions, type LayoutChangeEvent } from 'react-native';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * The camera's aiming frame — vignette, corner brackets, a hint pill — and the gate that
 * accepts a code only when its centre is inside it. Shared by the door scanner and
 * «ربط كارت المدرّس» (founder 2026-11-05: the link camera had no focus box).
 */

// The corners: each an L of two straight bars with round ends (founder 2026-11-05: the old
// two-sided rounded borders drew as a curl beside a line on iOS, outside a second faint box
// with another radius). Bars render the same on iOS and Android.
export const CORNER = 36;
export const STROKE = 5;

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

function Corner({ pos, left, top, tint }: { pos: 'tl' | 'tr' | 'bl' | 'br'; left: number; top: number; tint: string }) {
  const right = pos === 'tr' || pos === 'br';
  const bottom = pos === 'bl' || pos === 'br';
  const bar = { position: 'absolute' as const, backgroundColor: tint, borderRadius: STROKE / 2 };
  return (
    <View style={{ position: 'absolute', left: right ? left + FRAME_W - CORNER : left, top: bottom ? top + FRAME_H - CORNER : top, width: CORNER, height: CORNER }}>
      <View style={[bar, { left: 0, right: 0, height: STROKE, [bottom ? 'bottom' : 'top']: 0 }]} />
      <View style={[bar, { top: 0, bottom: 0, width: STROKE, [right ? 'right' : 'left']: 0 }]} />
    </View>
  );
}

/**
 * The frame itself. Everything is placed from ONE box position — the centre of the screen,
 * where the gate above reads — so the hole in the shade, the corners and the reading spot
 * always coincide; the hint sits below the box instead of pushing it up.
 */
export function ScanFrame({ tint = '#FFFFFF', icon = 'card', label, busy = false }: { tint?: string; icon?: IconName; label: string; busy?: boolean }) {
  const [size, setSize] = useState({ w: WIN_W, h: WIN_H });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height && (width !== size.w || height !== size.h)) setSize({ w: width, h: height });
  };
  const left = (size.w - FRAME_W) / 2;
  const top = (size.h - FRAME_H) / 2;
  const shade = { position: 'absolute' as const, backgroundColor: VIGNETTE };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none" onLayout={onLayout}>
      <View style={[shade, { left: 0, right: 0, top: 0, height: top }]} />
      <View style={[shade, { left: 0, right: 0, top: top + FRAME_H, bottom: 0 }]} />
      <View style={[shade, { left: 0, top, width: left, height: FRAME_H }]} />
      <View style={[shade, { right: 0, top, width: left, height: FRAME_H }]} />
      <Corner pos="tl" left={left} top={top} tint={tint} />
      <Corner pos="tr" left={left} top={top} tint={tint} />
      <Corner pos="bl" left={left} top={top} tint={tint} />
      <Corner pos="br" left={left} top={top} tint={tint} />
      <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, top: top + FRAME_H + spacing.xl, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(13,18,48,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name={icon} size={16} color={tint} />}
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: '#fff', textAlign: 'center' }}>{label}</Text>
        </View>
      </View>
    </View>
  );
}
