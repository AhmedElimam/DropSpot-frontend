import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, shadows } from '@/theme/index';
import { NazerFace } from './NazerFace';
import { NazerStamp } from './NazerStamp';
import type { NazerSay } from '@/nazer/mood';

/**
 * الناظر in the middle of the home's shortcuts (founder 2026-10-22: «the headmaster in the
 * middle of the shortcuts instead of the banner»): his face in today's mood inside a white
 * ring, his stamp as a small badge when the matter is formal, his name under it. Tapping
 * opens his office, where his line and his notes are.
 */
export function NazerHub({ say, size = 72, onPress }: { say: NazerSay; size?: number; onPress: () => void }) {
  const { t } = useTranslation();
  const ring = size + 10;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('nazer.open_office')} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: ring, height: ring, borderRadius: ring / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.md }}>
        <NazerFace mood={say.mood} size={size} />
        {say.stamp ? <NazerStamp kind={say.stamp} size={Math.round(size * 0.42)} style={{ position: 'absolute', bottom: -2, end: -4 }} /> : null}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, marginTop: 6 }} numberOfLines={1}>{t('nazer.short_name')}</Text>
    </TouchableOpacity>
  );
}
