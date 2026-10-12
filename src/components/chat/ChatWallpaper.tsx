import { memo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Rect, Path, Circle, G } from 'react-native-svg';
import { colors, isDark } from '@/theme/index';

const BRAND_MARK = require('../../../assets/images/brand-logo.png');
const ROSE_CREST = require('../../../assets/images/rose/rose-stamp-navy.webp');

/** One tile of the wallpaper; the marks and the doodles share it so they never collide. */
export const TILE = 196;
// The DrosSpot emblem (≈1.14 : 1) and مدام روز's crest, placed inside each tile.
const LOGO = { x: 22, y: 20, h: 40, rotate: '-12deg' } as const;
const CREST = { x: 110, y: 102, size: 66, rotate: '9deg' } as const;

/** Where the marks go for a box this size: one emblem and one crest per tile. Pure. */
export function wallpaperMarks(width: number, height: number): Array<{ key: string; kind: 'logo' | 'crest'; x: number; y: number }> {
  if (width <= 0 || height <= 0) return [];
  const cols = Math.ceil(width / TILE);
  const rows = Math.ceil(height / TILE);
  const out: Array<{ key: string; kind: 'logo' | 'crest'; x: number; y: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ key: `l${r}-${c}`, kind: 'logo', x: c * TILE + LOGO.x, y: r * TILE + LOGO.y });
      out.push({ key: `c${r}-${c}`, kind: 'crest', x: c * TILE + CREST.x, y: r * TILE + CREST.y });
    }
  }
  return out;
}

/**
 * The room's wallpaper, in the house colours (founder 2026-10-12: «DrosSpot logo on the
 * background, Madam Rose's crest on the background, a DrosSpot-themed background — put some
 * love on that»):
 *
 *  - a soft wash: the brand's indigo tint at the top, the warm paper in the middle, a breath
 *    of apricot at the foot, so the room has a sky and a floor instead of a flat sheet;
 *  - a lattice of the DrosSpot emblem and مدام روز's crest, tilted against each other, in
 *    the brand ink at a whisper — present the way a watermark is, never louder than a message;
 *  - school doodles between them (an open book, a pencil, a ruler, a bulb, a chalk tick, a
 *    sheet), drawn as one vector tile.
 *
 * Everything is static: the layer is rasterised once (iOS) / kept as a hardware texture
 * (Android), so scrolling the messages over it costs nothing. Colours are read at render, so
 * the light and dark schemes each get their own ink. No stars.
 */
export const ChatWallpaper = memo(function ChatWallpaper() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const dark = isDark();
  const ink = dark ? '#A9B7FF' : colors.brand;
  const doodleOpacity = dark ? 0.085 : 0.06;
  const markOpacity = dark ? 0.11 : 0.07;
  const marks = wallpaperMarks(box.w, box.h);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.abs(width - box.w) > 1 || Math.abs(height - box.h) > 1) setBox({ w: width, h: height });
      }}
    >
      <LinearGradient
        colors={dark
          ? [colors.brandTint, colors.background, colors.background]
          : [colors.brandTint, colors.background, colors.background, colors.accentWarmTint]}
        locations={dark ? [0, 0.45, 1] : [0, 0.38, 0.72, 1]}
        style={[StyleSheet.absoluteFill, { opacity: dark ? 0.55 : 0.75 }]}
      />

      {/* LTR on purpose: under the app's forced RTL an absolute `left` means "start" and the
          marks would mirror away from the gaps the (physical) doodle tile leaves for them. */}
      <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]} shouldRasterizeIOS renderToHardwareTextureAndroid>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="dros-doodles" patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
              <G stroke={ink} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={doodleOpacity}>
                {/* open book — top end */}
                <Path d="M120 30c8-4 16-4 22 0v20c-6-4-14-4-22 0zM142 30c6-4 14-4 22 0v20c-8-4-16-4-22 0" />
                {/* a sheet with lines — right middle */}
                <Path d="M156 62h22v26h-22zM161 70h12M161 76h12M161 82h7" />
                {/* bulb — centre */}
                <Path d="M88 70a12 12 0 0 1 7 22v5h-14v-5a12 12 0 0 1 7-22zM83 102h10" />
                {/* pencil — lower start */}
                <Path d="M22 116l32 32M18 120l8-4 32 32-4 8-8 4-32-32zM52 150l6 2-2-6" />
                {/* chalk tick — between pencil and crest */}
                <Path d="M78 150l7 7 14-15" />
                {/* ruler — foot */}
                <Path d="M20 176h56v12H20zM32 176v5M44 176v5M56 176v5M68 176v5M26 176v3M38 176v3M50 176v3M62 176v3" />
                {/* dots */}
                <Circle cx="98" cy="22" r="2.4" />
                <Circle cx="184" cy="184" r="2.4" />
                <Circle cx="10" cy="86" r="2" />
              </G>
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dros-doodles)" />
        </Svg>

        {marks.map((m) => (
          <Image
            key={m.key}
            source={m.kind === 'logo' ? BRAND_MARK : ROSE_CREST}
            fadeDuration={0}
            style={m.kind === 'logo'
              ? { position: 'absolute', left: m.x, top: m.y, height: LOGO.h, width: Math.round(LOGO.h * 1.14), tintColor: ink, opacity: markOpacity, transform: [{ rotate: LOGO.rotate }] }
              : { position: 'absolute', left: m.x, top: m.y, height: CREST.size, width: CREST.size, tintColor: ink, opacity: markOpacity, transform: [{ rotate: CREST.rotate }] }}
            resizeMode="contain"
          />
        ))}
      </View>
    </View>
  );
});
