import { memo } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/**
 * A friendly little face generated from a seed — the same seed always gives the same face,
 * so a person keeps their avatar across every screen without anyone uploading a photo.
 * Founder 2026-10-03: initials «sometimes make a weird name»; this replaces them for
 * students and teachers alike. Drawn in the "beam" manner: a coloured backdrop, a tilted
 * body blob in a second colour, two eyes and a mouth (smiling or open) in a contrast ink.
 * Pure SVG, no network, cheap enough for a roster row.
 */
const SIZE = 36;

// Sanad-friendly colours: ink indigo, apricot, muted green, coral, teal, gold — no purple.
const PALETTE = ['#34419B', '#E7913A', '#1F9366', '#E9655C', '#2A9DB0', '#C9A227', '#4A57B5', '#D97B22'];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const digit = (n: number, place: number) => Math.floor((n / 10 ** place) % 10);
const bool = (n: number, place: number) => digit(n, place) % 2 === 0;
function unit(n: number, range: number, place?: number): number {
  const v = n % range;
  return place !== undefined && digit(n, place) % 2 === 0 ? -v : v;
}

/** Black or white ink, whichever reads on the given fill. */
function contrast(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#1A2140' : '#FFFFFF';
}

export function avatarFeatures(seed: string) {
  const n = hashCode(seed || '?');
  const wrapperColor = PALETTE[n % PALETTE.length];
  const backgroundColor = PALETTE[(n + 13) % PALETTE.length] === wrapperColor ? PALETTE[(n + 5) % PALETTE.length] : PALETTE[(n + 13) % PALETTE.length];
  const preX = unit(n, 10, 1);
  const preY = unit(n, 10, 2);
  const wrapperTranslateX = preX < 5 ? preX + SIZE / 9 : preX;
  const wrapperTranslateY = preY < 5 ? preY + SIZE / 9 : preY;
  return {
    wrapperColor,
    backgroundColor,
    faceColor: contrast(wrapperColor),
    wrapperTranslateX,
    wrapperTranslateY,
    wrapperRotate: unit(n, 360),
    wrapperScale: 1 + unit(n, SIZE / 12) / 10,
    isMouthOpen: bool(n, 2),
    isCircle: bool(n, 1),
    eyeSpread: unit(n, 5),
    mouthSpread: unit(n, 3),
    faceRotate: unit(n, 10, 3),
    faceTranslateX: wrapperTranslateX > SIZE / 6 ? wrapperTranslateX / 2 : unit(n, 8, 1),
    faceTranslateY: wrapperTranslateY > SIZE / 6 ? wrapperTranslateY / 2 : unit(n, 7, 2),
  };
}

export const GeneratedAvatar = memo(function GeneratedAvatar({ seed, size = 40, square = false, label }: {
  /** Anything stable for the person: an id, or the name when nothing better exists. */
  seed: string;
  size?: number;
  /** Rounded square instead of a circle (for tiles). */
  square?: boolean;
  label?: string;
}) {
  const f = avatarFeatures(seed);
  const radius = square ? SIZE * 0.28 : SIZE / 2;
  const clipId = `clip-${hashCode(seed).toString(36)}`;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={label ?? seed}>
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect width={SIZE} height={SIZE} rx={radius} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <Rect width={SIZE} height={SIZE} fill={f.backgroundColor} />
          <Rect
            x={0}
            y={0}
            width={SIZE}
            height={SIZE}
            rx={f.isCircle ? SIZE : SIZE / 6}
            fill={f.wrapperColor}
            transform={`translate(${f.wrapperTranslateX} ${f.wrapperTranslateY}) rotate(${f.wrapperRotate} ${SIZE / 2} ${SIZE / 2}) scale(${f.wrapperScale})`}
          />
          <G transform={`translate(${f.faceTranslateX} ${f.faceTranslateY}) rotate(${f.faceRotate} ${SIZE / 2} ${SIZE / 2})`}>
            {f.isMouthOpen ? (
              <Path d={`M15 ${19 + f.mouthSpread}c2 1 4 1 6 0`} stroke={f.faceColor} strokeWidth={1.4} fill="none" strokeLinecap="round" />
            ) : (
              <Path d={`M13,${19 + f.mouthSpread} a1,0.75 0 0,0 10,0`} fill={f.faceColor} />
            )}
            <Rect x={14 - f.eyeSpread} y={14} width={1.6} height={2.2} rx={1} fill={f.faceColor} />
            <Rect x={20 + f.eyeSpread} y={14} width={1.6} height={2.2} rx={1} fill={f.faceColor} />
          </G>
        </G>
      </Svg>
    </View>
  );
});
