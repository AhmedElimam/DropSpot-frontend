import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { NazerFace } from './NazerFace';
import { NazerStamp } from './NazerStamp';
import type { NazerSay } from '@/nazer/mood';

/**
 * الناظر among the home's shortcuts, drawn the way مدام روز sits among the teacher's
 * (founder 2026-10-22: «in the style of the teacher UI»): his face in the tile's 58-pt
 * square, no ring, his name under it like the other labels, and his stamp as the badge
 * in the corner when the matter is formal. Tapping opens his office.
 */
export function NazerHub({ say, size = 64, onPress }: { say: NazerSay; size?: number; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('nazer.open_office')} style={{ alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
        <NazerFace mood={say.mood} size={size} />
        {say.stamp ? <NazerStamp kind={say.stamp} size={26} style={{ position: 'absolute', top: -6, end: -8 }} /> : null}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>{t('nazer.short_name')}</Text>
    </TouchableOpacity>
  );
}
