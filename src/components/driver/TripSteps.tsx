import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { DELIVERY_FLOW } from '@/api/driver';

/** The trip's walk: one numbered dot per step (done ✓, now, to come) with its name under it. */
export function TripSteps({ at }: { at: number }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
        {DELIVERY_FLOW.map((s, i) => (
          <View key={s} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i < at ? colors.success : i === at ? colors.brand : colors.surfaceSunken }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: i <= at ? colors.onPrimary : colors.textTertiary }}>{i < at ? '✓' : i + 1}</Text>
            </View>
            {i < DELIVERY_FLOW.length - 1 ? <View style={{ flex: 1, height: 2, backgroundColor: i < at ? colors.success : colors.border }} /> : null}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {DELIVERY_FLOW.map((s) => <Text key={s} style={{ fontFamily: fonts.medium, fontSize: 9.5, color: colors.textTertiary }}>{t(`driver.step_${s}`)}</Text>)}
      </View>
    </>
  );
}
