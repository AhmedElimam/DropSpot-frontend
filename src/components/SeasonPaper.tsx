import { memo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop, Line } from 'react-native-svg';
import { REVISION_INK } from '@/theme/revision';
import { useRevisionActive } from '@/hooks/useRevisionTheme';

/**
 * The season's paper, laid inside a teacher hero while «وضع المراجعة» is on (founder
 * 2026-10-17: «on dark or light there's not much of a change»). Three quiet marks, the ones a
 * student's answer sheet has: faint ruled lines across the band, the amber MARGIN line down the
 * start side, and a warm lamp glow in the top end corner, behind the logo. It is what makes any screenshot of the
 * teacher app read «revision» before a word is read.
 *
 * Static vectors — drawn once, no animation, nothing that commits per frame on Android. Renders
 * nothing off season, so a hero mounts it unconditionally as its FIRST child (it sits under the
 * hero's content). `radius` = the hero's bottom corners, so the paper is clipped with them.
 */
let seq = 0;

export const SeasonPaper = memo(function SeasonPaper({ radius = 0, margin = true }: { radius?: number; margin?: boolean }) {
  const on = useRevisionActive();
  const id = useRef(`sp${(seq += 1)}`).current;
  if (!on) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderBottomLeftRadius: radius, borderBottomRightRadius: radius }]}>
      {/* The ruled lines: a 26 pt pattern, white at a whisper. */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id={`${id}r`} patternUnits="userSpaceOnUse" width={26} height={26}>
            <Line x1={0} y1={25.5} x2={26} y2={25.5} stroke="#FFFFFF" strokeOpacity={0.055} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id}r)`} />
      </Svg>
      {/* The lamp: a warm glow in the top end corner, behind the logo (end follows RTL; the SVG would not). */}
      <View style={{ position: 'absolute', top: -150, end: -120, width: 360, height: 360 }}>
        <Svg width={360} height={360}>
          <Defs>
            <RadialGradient id={`${id}l`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={REVISION_INK.amberGlow} stopOpacity={0.30} />
              <Stop offset="0.45" stopColor={REVISION_INK.amber} stopOpacity={0.12} />
              <Stop offset="1" stopColor={REVISION_INK.amber} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={360} height={360} fill={`url(#${id}l)`} />
        </Svg>
      </View>
      {/* The margin: the one red-pen line every answer sheet has — amber here. */}
      {margin ? <View style={{ position: 'absolute', top: 0, bottom: 0, start: 8, width: 1.5, backgroundColor: REVISION_INK.amber, opacity: 0.32 }} /> : null}
    </View>
  );
});
