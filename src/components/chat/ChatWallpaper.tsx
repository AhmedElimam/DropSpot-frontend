import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path, Circle, G } from 'react-native-svg';
import { colors, isDark } from '@/theme/index';

/**
 * The room's wallpaper (founder 2026-10-12: «some love on the background of the chat»): the
 * warm paper every screen wears, with faint school doodles tiled over it — an open book, a
 * pencil, a ruler, a bulb, a chalk tick — in the app's own ink at a whisper of opacity.
 * One vector tile repeated, so it costs one draw call and no image decode; and no stars
 * (the founder reads the 8-point star as someone else's brand).
 */
export const ChatWallpaper = memo(function ChatWallpaper() {
  const ink = isDark() ? '#9FB0FF' : colors.brand;
  const opacity = isDark() ? 0.07 : 0.055;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="doodles" patternUnits="userSpaceOnUse" width="168" height="168">
            <G stroke={ink} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
              {/* open book */}
              <Path d="M14 30c8-4 16-4 22 0v22c-6-4-14-4-22 0zM36 30c6-4 14-4 22 0v22c-8-4-16-4-22 0" />
              {/* pencil */}
              <Path d="M96 18l34 34M92 22l8-4 34 34-4 8-8 4-34-34zM128 54l6 2-2-6" />
              {/* ruler */}
              <Path d="M18 100h52v14H18zM30 100v6M42 100v6M54 100v6M24 100v4M36 100v4M48 100v4M60 100v4" />
              {/* bulb */}
              <Path d="M126 92a14 14 0 0 1 8 25v6h-16v-6a14 14 0 0 1 8-25zM120 128h12" />
              {/* chalk tick + dots */}
              <Path d="M70 148l8 8 14-16" />
              <Circle cx="150" cy="150" r="3" />
              <Circle cx="18" cy="68" r="2.2" />
              <Circle cx="152" cy="20" r="2.2" />
              {/* a tiny sheet with two lines */}
              <Path d="M94 136h24v22H94zM100 144h12M100 150h8" />
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#doodles)" />
      </Svg>
    </View>
  );
});
