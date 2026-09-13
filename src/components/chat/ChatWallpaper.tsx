import { View } from 'react-native';
import Svg, { Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { chat } from '@/theme/chat';

/**
 * The papered ground behind a room's messages — the chat-app cue that says "this is a
 * conversation, not a list". A tiled SVG pattern rather than a bitmap: it is a few hundred
 * bytes, scales to any density, and re-tints with one token.
 *
 * The doodles are the product's own vocabulary (book, pencil, star, protractor arc) instead
 * of a messenger's, at an opacity low enough that it reads as texture and never competes
 * with a message. Absolutely positioned and `pointerEvents="none"`, so it is purely a
 * backdrop: scrolling and long-press all pass straight through it.
 */
export function ChatWallpaper() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: chat.wallpaper }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="doodles" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            <G
              stroke={chat.wallpaperInk}
              strokeOpacity={chat.wallpaperInkOpacity}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* open book */}
              <Path d="M12 30 C18 26 26 26 31 29 L31 44 C26 41 18 41 12 45 Z" />
              <Path d="M31 29 C36 26 44 26 50 30 L50 45 C44 41 36 41 31 44 Z" />
              {/* pencil */}
              <Path d="M78 20 L92 34 L84 42 L70 28 Z" />
              <Path d="M70 28 L66 46 L84 42" />
              {/* star */}
              <Path d="M30 78 L34 88 L45 89 L36 96 L39 107 L30 101 L21 107 L24 96 L15 89 L26 88 Z" />
              {/* protractor arc */}
              <Path d="M72 104 A18 18 0 0 1 108 104 Z" />
              <Path d="M90 104 L90 92" />
            </G>
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#doodles)" />
      </Svg>
    </View>
  );
}
