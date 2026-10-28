import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme/index';

/**
 * Dros Spot's own reactions (founder 2026-10-28: «we need our own reacts for chat, threads and
 * the community»): one family of round badges drawn in the app's palette instead of the phone's
 * emoji, the same on every phone and in both schemes. Chat keeps its six (👍 ❤️ 😂 😮 😢 🙏, stored
 * as emoji by the server), the community its four (like, love, clap, idea); حكاوي's vote wears
 * the same thumb.
 *
 * Drawn on a 48-unit grid (founder: «the icons look pixelated» — the first set was traced on 24
 * with thin strokes): full shapes, a soft gloss on top, and a ring cut out of the badge itself
 * rather than a hairline stroke, so they stay crisp at 16 pt. Static — nothing here animates.
 */
export type ReactionKind = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'thanks' | 'clap' | 'idea';

export const REACTION_KINDS: ReactionKind[] = ['like', 'love', 'haha', 'wow', 'sad', 'thanks', 'clap', 'idea'];

/** Chat stores the emoji itself; each one is drawn as ours. */
export const EMOJI_KIND: Record<string, ReactionKind> = { '👍': 'like', '❤️': 'love', '😂': 'haha', '😮': 'wow', '😢': 'sad', '🙏': 'thanks', '👏': 'clap', '💡': 'idea' };

/** Each badge's two tones (top → bottom) and the label colour that goes with it. */
export const REACTION_TONE: Record<ReactionKind, { from: string; to: string; ink: string }> = {
  like: { from: '#6475FF', to: '#2F3BA6', ink: '#3A47B8' },
  love: { from: '#FF7A8E', to: '#D9204A', ink: '#D6264B' },
  haha: { from: '#FFE27A', to: '#F5A20E', ink: '#C9820A' },
  wow: { from: '#FFE27A', to: '#F5A20E', ink: '#C9820A' },
  sad: { from: '#FFE27A', to: '#F5A20E', ink: '#C9820A' },
  thanks: { from: '#43D6B6', to: '#0E8068', ink: '#11836C' },
  clap: { from: '#BC92FF', to: '#6A35C9', ink: '#6E3CCB' },
  idea: { from: '#FFD452', to: '#EF850D', ink: '#C9700A' },
};

const FACE = '#5A3605';

function Symbol({ kind, ink }: { kind: ReactionKind; ink: string }) {
  switch (kind) {
    case 'like':
      return (
        <G fill={ink}>
          <Rect x={11.6} y={22} width={6.4} height={14.4} rx={2.2} />
          <Path d="M20.4 22.4 L25.6 13.2 C26.4 11.8 28.7 12 29.1 13.7 C29.3 14.4 29.2 15.2 29 15.9 L28 20.4 H34.7 C36.8 20.4 38.2 22.4 37.6 24.4 L34.7 33.9 C34.3 35.4 32.9 36.4 31.4 36.4 H20.4 Z" />
        </G>
      );
    case 'love':
      return <Path fill={ink} d="M24 36.4 C23.6 36.4 23.2 36.3 22.9 36 C18 32.3 12.6 27.9 12.6 22 C12.6 18.3 15.5 15.4 19.1 15.4 C21.2 15.4 23 16.4 24 18 C25 16.4 26.8 15.4 28.9 15.4 C32.5 15.4 35.4 18.3 35.4 22 C35.4 27.9 30 32.3 25.1 36 C24.8 36.3 24.4 36.4 24 36.4 Z" />;
    case 'haha':
      return (
        <G>
          <Path d="M14.2 20.4 Q17.4 16.4 20.6 20.4" stroke={ink} strokeWidth={2.7} strokeLinecap="round" fill="none" />
          <Path d="M27.4 20.4 Q30.6 16.4 33.8 20.4" stroke={ink} strokeWidth={2.7} strokeLinecap="round" fill="none" />
          <Path d="M14.4 25.2 H33.6 C33.6 31.4 29.3 35.8 24 35.8 C18.7 35.8 14.4 31.4 14.4 25.2 Z" fill={ink} />
          <Rect x={15.6} y={25.2} width={16.8} height={2.2} rx={0.8} fill="#FFFFFF" opacity={0.92} />
          <Path d="M18.8 32.5 C20.1 30.7 21.9 29.9 24 29.9 C26.1 29.9 27.9 30.7 29.2 32.5 C27.8 34 26 34.8 24 34.8 C22 34.8 20.2 34 18.8 32.5 Z" fill="#FF6F86" />
        </G>
      );
    case 'wow':
      return (
        <G>
          <Path d="M14.2 15.6 Q17.4 12.8 20.6 14.8" stroke={ink} strokeWidth={2.3} strokeLinecap="round" fill="none" />
          <Path d="M27.4 14.8 Q30.6 12.8 33.8 15.6" stroke={ink} strokeWidth={2.3} strokeLinecap="round" fill="none" />
          <Ellipse cx={17.6} cy={21.2} rx={2.3} ry={3.1} fill={ink} />
          <Ellipse cx={30.4} cy={21.2} rx={2.3} ry={3.1} fill={ink} />
          <Ellipse cx={24} cy={31.2} rx={4.3} ry={5.3} fill={ink} />
        </G>
      );
    case 'sad':
      return (
        <G>
          <Path d="M14 17.8 L19.8 15.4" stroke={ink} strokeWidth={2.3} strokeLinecap="round" />
          <Path d="M34 17.8 L28.2 15.4" stroke={ink} strokeWidth={2.3} strokeLinecap="round" />
          <Ellipse cx={17.6} cy={22.2} rx={2.2} ry={2.8} fill={ink} />
          <Ellipse cx={30.4} cy={22.2} rx={2.2} ry={2.8} fill={ink} />
          <Path d="M17.4 33.4 Q24 28.2 30.6 33.4" stroke={ink} strokeWidth={2.9} strokeLinecap="round" fill="none" />
          <Path d="M33 25 C33 25 30.8 28.2 30.8 29.5 C30.8 30.7 31.8 31.7 33 31.7 C34.2 31.7 35.2 30.7 35.2 29.5 C35.2 28.2 33 25 33 25 Z" fill="#3FA9F5" />
        </G>
      );
    case 'thanks':
      return (
        <G fill={ink}>
          <Path d="M23 12.2 C22 12.2 21.2 12.9 21 13.9 L18.3 25.6 L14.7 29 C14.2 29.5 13.9 30.2 13.9 30.9 V35.4 H20.4 L23 32.6 Z" />
          <Path d="M25 12.2 C26 12.2 26.8 12.9 27 13.9 L29.7 25.6 L33.3 29 C33.8 29.5 34.1 30.2 34.1 30.9 V35.4 H27.6 L25 32.6 Z" />
          <Rect x={13.2} y={35.4} width={8} height={3.2} rx={1.2} opacity={0.85} />
          <Rect x={26.8} y={35.4} width={8} height={3.2} rx={1.2} opacity={0.85} />
        </G>
      );
    case 'clap':
      return (
        <G fill={ink}>
          <G transform="rotate(-22 19 27)">
            <Rect x={14.4} y={17} width={9.4} height={19.6} rx={4.7} />
            <Ellipse cx={24.6} cy={28.4} rx={2.3} ry={3.8} />
          </G>
          <G transform="rotate(22 29 27)" opacity={0.9}>
            <Rect x={24.2} y={17} width={9.4} height={19.6} rx={4.7} />
            <Ellipse cx={23.4} cy={28.4} rx={2.3} ry={3.8} />
          </G>
          <G stroke={ink} strokeWidth={2.2} strokeLinecap="round">
            <Path d="M15.4 11.6 L13.8 9.2" />
            <Path d="M24 10.2 V7.4" />
            <Path d="M32.6 11.6 L34.2 9.2" />
          </G>
        </G>
      );
    case 'idea':
      return (
        <G fill={ink}>
          <Path d="M24 11.4 C19.2 11.4 15.6 15.2 15.6 19.8 C15.6 22.8 17.2 25 19.2 26.6 C20 27.2 20.6 28.2 20.6 29.2 V30.4 H27.4 V29.2 C27.4 28.2 28 27.2 28.8 26.6 C30.8 25 32.4 22.8 32.4 19.8 C32.4 15.2 28.8 11.4 24 11.4 Z" />
          <Rect x={20.6} y={31.8} width={6.8} height={2.4} rx={1.2} />
          <Rect x={21.6} y={35.1} width={4.8} height={2.2} rx={1.1} />
          <G stroke={ink} strokeWidth={2.2} strokeLinecap="round">
            <Path d="M24 5.8 V7.8" />
            <Path d="M13.6 9.8 L15.1 11.3" />
            <Path d="M34.4 9.8 L32.9 11.3" />
          </G>
        </G>
      );
  }
}

/**
 * One reaction badge. `muted` draws it quiet (a grey disc, the symbol in the tertiary ink) for an
 * action that is not yours yet; `ring` cuts a ring in the colour it sits on (stacked faces).
 */
export const ReactionGlyph = memo(function ReactionGlyph({ kind, size = 20, muted = false, ring }: { kind: ReactionKind; size?: number; muted?: boolean; ring?: string }) {
  const tone = REACTION_TONE[kind];
  const face = kind === 'haha' || kind === 'wow' || kind === 'sad';
  const id = `rg-${kind}`;
  const r = ring ? 21.2 : 24;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={id} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={tone.from} />
          <Stop offset="1" stopColor={tone.to} />
        </LinearGradient>
      </Defs>
      {ring ? <Circle cx={24} cy={24} r={24} fill={ring} /> : null}
      <Circle cx={24} cy={24} r={r} fill={muted ? colors.surfaceSunken : `url(#${id})`} />
      {/* A soft gloss across the top half. */}
      {muted ? null : <Ellipse cx={24} cy={24 - r * 0.46} rx={r * 0.72} ry={r * 0.4} fill="#FFFFFF" opacity={0.2} />}
      <G transform={ring ? `translate(${24 - 24 * (r / 24)} ${24 - 24 * (r / 24)}) scale(${r / 24})` : undefined}>
        <Symbol kind={kind} ink={muted ? colors.textTertiary : face ? FACE : '#FFFFFF'} />
      </G>
    </Svg>
  );
});

/** A chat emoji drawn as ours; anything outside the family stays the emoji it is. */
export function kindOfEmoji(emoji: string): ReactionKind | null {
  return EMOJI_KIND[emoji] ?? null;
}
