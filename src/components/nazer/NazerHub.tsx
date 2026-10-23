import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { NazerFramed } from './NazerFramed';
import type { NazerSay } from '@/nazer/mood';

/**
 * الناظر among the home's shortcuts, drawn the way مدام روز sits among the teacher's
 * (founder 2026-10-22: «in the style of the teacher UI»): his picture in her frame — her
 * ring and crown (NazerFramed), at the size her framed portrait has on the teacher home
 * (founder 2026-10-23: «the frame doesn't show on the home like Madam Rose») — in the
 * tile's 58-pt square, his name under it like the other labels. No stamp on the home tile
 * (founder 2026-10-22); his stamps live in his office. Tapping opens his office.
 */
export function NazerHub({ say, size = 64, onPress }: { say: NazerSay; size?: number; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('nazer.open_office')} style={{ alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
        <NazerFramed mood={say.mood} size={size} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>{t('nazer.short_name')}</Text>
    </TouchableOpacity>
  );
}
