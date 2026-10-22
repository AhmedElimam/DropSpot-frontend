import { useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/ui/surfaces';
import { TypedGreeting } from '@/components/rose/RoseHero';
import { NazerFace } from './NazerFace';
import { NazerStamp } from './NazerStamp';
import type { NazerSay } from '@/nazer/mood';

const ON = '#FFFFFF';
const ON_SOFT = 'rgba(255,255,255,0.72)';
const CHIP = 'rgba(255,255,255,0.12)';
const PORTRAIT = 148;

/**
 * «مكتب الناظر» — the band at the top of his office, built the way مدام روز's desk is
 * (RoseHero): the navy gradient, a square back button, his face large with his name and
 * title under it, and a speech bubble pointing up at him that types what he says today. His
 * stamp sits by the bubble when the matter is formal; facts as chips under the line.
 */
export function NazerHero({ say, lines, onBack, children }: { say: NazerSay; lines?: string[]; onBack: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [, setTalking] = useState(false);
  return (
    <LinearGradient colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="forward" size={22} color={ON} />
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <Surface id="family.nazer.hero.portrait">
      <View style={{ alignItems: 'center', marginTop: -spacing.lg }}>
        <View>
          <NazerFace mood={say.mood} size={PORTRAIT} />
          {say.stamp ? <NazerStamp kind={say.stamp} size={64} style={{ position: 'absolute', bottom: -6, end: -22 }} /> : null}
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: ON, marginTop: spacing.xs }}>{t('nazer.name')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: ON_SOFT }}>{t('nazer.role')}</Text>
      </View>
      </Surface>

      {/* His speech bubble, pointing up at him. */}
      <Surface id="family.nazer.hero.bubble">
      <View style={{ marginTop: spacing.md }}>
        <View style={{ alignSelf: 'center', width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.surface }} />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
          <TypedGreeting text={say.line} start onTalking={setTalking} />
          {lines && lines.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}>
              {lines.map((line) => (
                <View key={line} style={{ backgroundColor: colors.brandTint, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{line}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      </Surface>

      {children}
    </LinearGradient>
  );
}
