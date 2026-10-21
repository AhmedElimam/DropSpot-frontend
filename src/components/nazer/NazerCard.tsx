import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { NazerFace } from './NazerFace';
import { NazerStamp } from './NazerStamp';
import type { NazerSay } from '@/nazer/mood';

/**
 * «من مكتب الناظر»: the home card where الناظر says one thing about today — his face in the
 * mood the facts call for, the line, and his stamp when the matter is formal. Tapping it
 * opens his office. One card, one sentence; the rest waits in the office.
 */
export function NazerCard({ say, onPress }: { say: NazerSay; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={t('nazer.open_office')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.md, overflow: 'hidden' }}>
      <NazerFace mood={say.mood} size={76} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.accent }}>{t('nazer.from_office')}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 23, color: colors.textPrimary, marginTop: 2 }}>{say.line}</Text>
        {say.routeLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{say.routeLabel}</Text>
            <Icon name="back" size={14} color={colors.brand} />
          </View>
        ) : null}
      </View>
      {say.stamp ? <NazerStamp kind={say.stamp} size={54} style={{ position: 'absolute', top: 6, left: 6, opacity: 0.85 }} /> : null}
    </TouchableOpacity>
  );
}
