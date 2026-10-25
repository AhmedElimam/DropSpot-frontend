import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRose } from '@/hooks/useRose';
import { useRosePictures } from './RoseCostume';

/**
 * مدام روز at her desk when nothing waits on it. She used to doze here — eyes closed, «Z z z»
 * drifting up (founder 2026-10-09). Since 2026-10-25 she is painted, and the closed eyes we
 * painted over her portrait «look unnatural» (founder), so until a sleeping pose comes from
 * the image model she simply rests: her portrait, head a touch to one side, still. Nothing
 * animates here at all.
 */
const CHIN = { x: 200, y: 392 };

/**
 * Her resting picture — drawn once and never again: memoised.
 */
const StillFace = memo(function StillFace({ size }: { size: number }) {
  const k = size / 400;
  const pictures = useRosePictures();
  return (
    // Her head already resting to one side — still. Scaling the picture every frame was the costly part.
    <View style={{ width: size, height: size, transformOrigin: [CHIN.x * k, CHIN.y * k, 0], transform: [{ rotate: '-4deg' }] }}>
      <Image source={pictures.portrait} style={StyleSheet.absoluteFill} contentFit="contain" />
    </View>
  );
});

export function RoseSleeping({ size }: { size: number }) {
  const rose = useRose();
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${rose.name} — مستريحة`}>
      <StillFace size={size} />
    </View>
  );
}
