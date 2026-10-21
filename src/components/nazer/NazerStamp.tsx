import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { fonts } from '@/theme/typography';

export type NazerStampKind = 'notice' | 'approved';

const INK: Record<NazerStampKind, { color: string; word: string; tilt: string; dashed: boolean }> = {
  // «لفت نظر» in red: a repeated absence, a late bill — the firm word, with the heart kept.
  notice: { color: '#B3261E', word: 'لفت نظر', tilt: '10deg', dashed: true },
  // «اعتمد» in navy: a full month, a certificate, a receipt.
  approved: { color: '#1B2A5E', word: 'اعتمد', tilt: '-8deg', dashed: false },
};

/** الناظر's two ink stamps, drawn as vectors so they stay crisp at any size. */
export function NazerStamp({ kind, size = 56, style }: { kind: NazerStampKind; size?: number; style?: StyleProp<ViewStyle> }) {
  const ink = INK[kind];
  return (
    <View style={[{ width: size, height: size, transform: [{ rotate: ink.tilt }] }, style]} pointerEvents="none" accessibilityRole="image" accessibilityLabel={`ختم ${ink.word}`}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Circle cx="60" cy="60" r="54" fill="none" stroke={ink.color} strokeWidth="6" opacity="0.9" />
        <Circle cx="60" cy="60" r="45" fill="none" stroke={ink.color} strokeWidth="2" strokeDasharray={ink.dashed ? '6 4' : undefined} opacity="0.8" />
        <SvgText x="60" y={kind === 'notice' ? 70 : 72} textAnchor="middle" fontFamily={fonts.bold} fontSize={kind === 'notice' ? 26 : 32} fontWeight="bold" fill={ink.color}>
          {ink.word}
        </SvgText>
      </Svg>
    </View>
  );
}
