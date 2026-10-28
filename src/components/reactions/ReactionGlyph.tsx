import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme/index';

/**
 * Dros Spot's own reactions (founder 2026-10-28: «we need our own reacts for chat, threads and
 * the community»): one family of round badges drawn in the app's palette instead of the phone's
 * emoji, the same on every phone and in both schemes. Chat keeps its six (👍 ❤️ 😂 😮 😢 🙏, stored
 * as emoji by the server), the community its four (like, love, clap, idea); حكاوي's vote wears
 * the same thumb. Static — nothing here animates (a picker may pop them in once).
 */
export type ReactionKind = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'thanks' | 'clap' | 'idea';

export const REACTION_KINDS: ReactionKind[] = ['like', 'love', 'haha', 'wow', 'sad', 'thanks', 'clap', 'idea'];

/** Chat stores the emoji itself; each one is drawn as ours. */
export const EMOJI_KIND: Record<string, ReactionKind> = { '👍': 'like', '❤️': 'love', '😂': 'haha', '😮': 'wow', '😢': 'sad', '🙏': 'thanks', '👏': 'clap', '💡': 'idea' };

/** Each badge's two tones (top-left → bottom-right) and the label colour that goes with it. */
export const REACTION_TONE: Record<ReactionKind, { from: string; to: string; ink: string }> = {
  like: { from: '#5B6CF0', to: '#2E3990', ink: '#3A47B8' },
  love: { from: '#FF6B81', to: '#D6264B', ink: '#D6264B' },
  haha: { from: '#FFD86B', to: '#F2A516', ink: '#C9820A' },
  wow: { from: '#FFD86B', to: '#F2A516', ink: '#C9820A' },
  sad: { from: '#FFD86B', to: '#F2A516', ink: '#C9820A' },
  thanks: { from: '#3CCBAE', to: '#11836C', ink: '#11836C' },
  clap: { from: '#B386FF', to: '#6E3CCB', ink: '#6E3CCB' },
  idea: { from: '#FFCF4D', to: '#EE8A12', ink: '#C9700A' },
};

const FACE = '#5A3808';

function Symbol({ kind, ink }: { kind: ReactionKind; ink: string }) {
  switch (kind) {
    case 'like':
      return (
        <G fill={ink}>
          <Rect x={6.1} y={11} width={2.7} height={6.9} rx={0.9} />
          <Path d="M9.9 11.3 L12.5 6.6 C12.9 5.9 14.2 6.1 14.2 7.1 L13.8 10 H16.9 C17.9 10 18.5 10.9 18.2 11.8 L16.7 16.9 C16.5 17.5 16 17.9 15.4 17.9 H9.9 Z" />
        </G>
      );
    case 'love':
      return <Path fill={ink} d="M12 17.7 C11.8 17.7 11.6 17.6 11.4 17.5 C9 15.7 6.5 13.6 6.5 10.9 C6.5 9.1 7.9 7.7 9.6 7.7 C10.6 7.7 11.5 8.2 12 9 C12.5 8.2 13.4 7.7 14.4 7.7 C16.1 7.7 17.5 9.1 17.5 10.9 C17.5 13.6 15 15.7 12.6 17.5 C12.4 17.6 12.2 17.7 12 17.7 Z" />;
    case 'haha':
      return (
        <G>
          <Path d="M7.4 10.2 Q8.7 8.5 10 10.2" stroke={FACE} strokeWidth={1.3} strokeLinecap="round" fill="none" />
          <Path d="M14 10.2 Q15.3 8.5 16.6 10.2" stroke={FACE} strokeWidth={1.3} strokeLinecap="round" fill="none" />
          <Path d="M7.4 12.8 H16.6 C16.6 15.8 14.5 17.8 12 17.8 C9.5 17.8 7.4 15.8 7.4 12.8 Z" fill={FACE} />
          <Path d="M9.6 16.4 C10.2 15.5 11 15.1 12 15.1 C13 15.1 13.8 15.5 14.4 16.4 C13.8 17.1 12.9 17.5 12 17.5 C11.1 17.5 10.2 17.1 9.6 16.4 Z" fill="#FF7A8A" />
        </G>
      );
    case 'wow':
      return (
        <G fill={FACE}>
          <Path d="M7.3 8 Q8.7 6.7 10.1 7.6" stroke={FACE} strokeWidth={1.1} strokeLinecap="round" fill="none" />
          <Path d="M13.9 7.6 Q15.3 6.7 16.7 8" stroke={FACE} strokeWidth={1.1} strokeLinecap="round" fill="none" />
          <Ellipse cx={8.8} cy={10.4} rx={1.1} ry={1.5} />
          <Ellipse cx={15.2} cy={10.4} rx={1.1} ry={1.5} />
          <Ellipse cx={12} cy={15.4} rx={2.1} ry={2.6} />
        </G>
      );
    case 'sad':
      return (
        <G>
          <Path d="M7.2 8.6 L9.9 7.6" stroke={FACE} strokeWidth={1.1} strokeLinecap="round" />
          <Path d="M16.8 8.6 L14.1 7.6" stroke={FACE} strokeWidth={1.1} strokeLinecap="round" />
          <Ellipse cx={8.8} cy={10.8} rx={1.05} ry={1.35} fill={FACE} />
          <Ellipse cx={15.2} cy={10.8} rx={1.05} ry={1.35} fill={FACE} />
          <Path d="M9 16.6 Q12 14.2 15 16.6" stroke={FACE} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          <Path d="M16.4 12.4 C16.4 12.4 15.4 13.9 15.4 14.5 C15.4 15.1 15.8 15.5 16.4 15.5 C17 15.5 17.4 15.1 17.4 14.5 C17.4 13.9 16.4 12.4 16.4 12.4 Z" fill="#4FB3F6" />
        </G>
      );
    case 'thanks':
      return (
        <G fill={ink}>
          <Path d="M11.55 6.3 C11.05 6.3 10.7 6.65 10.6 7.1 L9.1 13 L7.4 14.6 V18 H10.4 L11.55 16.3 Z" />
          <Path d="M12.45 6.3 C12.95 6.3 13.3 6.65 13.4 7.1 L14.9 13 L16.6 14.6 V18 H13.6 L12.45 16.3 Z" />
        </G>
      );
    case 'clap':
      return (
        <G>
          <Rect x={7.7} y={8.6} width={4.6} height={8.8} rx={2.3} fill={ink} transform="rotate(-20 10 13)" />
          <Rect x={11.7} y={8.6} width={4.6} height={8.8} rx={2.3} fill={ink} opacity={0.88} transform="rotate(20 14 13)" />
          <G stroke={ink} strokeWidth={1.1} strokeLinecap="round">
            <Path d="M8.6 6.4 L7.9 5.2" />
            <Path d="M12 5.8 V4.5" />
            <Path d="M15.4 6.4 L16.1 5.2" />
          </G>
        </G>
      );
    case 'idea':
      return (
        <G fill={ink}>
          <Path d="M12 5.8 C9.6 5.8 7.8 7.7 7.8 10 C7.8 11.5 8.6 12.6 9.6 13.4 C10 13.7 10.3 14.2 10.3 14.7 V15.2 H13.7 V14.7 C13.7 14.2 14 13.7 14.4 13.4 C15.4 12.6 16.2 11.5 16.2 10 C16.2 7.7 14.4 5.8 12 5.8 Z" />
          <Rect x={10.3} y={15.8} width={3.4} height={1.1} rx={0.55} />
          <Rect x={10.8} y={17.3} width={2.4} height={1} rx={0.5} />
        </G>
      );
  }
}

/**
 * One reaction badge. `muted` draws it quiet (a grey disc, the symbol in the tertiary ink) for an
 * action that is not yours yet; `ring` puts a ring in the colour it sits on (stacked faces).
 */
export const ReactionGlyph = memo(function ReactionGlyph({ kind, size = 20, muted = false, ring }: { kind: ReactionKind; size?: number; muted?: boolean; ring?: string }) {
  const tone = REACTION_TONE[kind];
  const face = kind === 'haha' || kind === 'wow' || kind === 'sad';
  const id = `rg-${kind}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {muted ? null : (
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tone.from} />
            <Stop offset="1" stopColor={tone.to} />
          </LinearGradient>
        </Defs>
      )}
      <Circle cx={12} cy={12} r={ring ? 11 : 12} fill={muted ? colors.surfaceSunken : `url(#${id})`} stroke={ring} strokeWidth={ring ? 2 : 0} />
      <Symbol kind={kind} ink={muted ? colors.textTertiary : face ? FACE : '#FFFFFF'} />
    </Svg>
  );
});

/** A chat emoji drawn as ours; anything outside the family stays the emoji it is. */
export function kindOfEmoji(emoji: string): ReactionKind | null {
  return EMOJI_KIND[emoji] ?? null;
}
