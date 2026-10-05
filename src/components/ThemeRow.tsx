import { View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePathname, type Href } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';
import { Icon } from '@/components/ui/Icon';
import { dark, light } from '@/theme/palettes';

const OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'common.appearance_system' },
  { key: 'light', label: 'common.appearance_light' },
  { key: 'dark', label: 'common.appearance_dark' },
];

/**
 * «المظهر» — the settings row every role gets (founder 2026-10-03). Three positions:
 * follow the phone, light, dark. The choice applies at once: the root re-keys the
 * navigation tree, and this screen's route is left as the place to come back to.
 */
export function ThemeRow() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const system = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <View
      style={{
        backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
          <Icon name="eye" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('common.appearance')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('common.appearance_sub')}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        {OPTIONS.map((o) => {
          const on = preference === o.key;
          // A swatch of what each position gives: the day mist, the night navy, or both.
          const swatch = o.key === 'light' ? [light.background, light.primary] : o.key === 'dark' ? [dark.background, dark.neon] : [light.background, dark.background];
          return (
            <TouchableOpacity
              key={o.key}
              onPress={() => { if (!on) void setPreference(o.key, system, pathname as Href); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              activeOpacity={0.8}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
                minHeight: 44, borderRadius: radius.lg, borderWidth: on ? 1.5 : 1,
                borderColor: on ? colors.neon : colors.border,
                backgroundColor: on ? colors.neonTint : colors.surfaceSunken,
              }}
            >
              <View style={{ flexDirection: 'row', width: 18, height: 18, borderRadius: 9, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderStrong }}>
                <View style={{ flex: 1, backgroundColor: swatch[0] }} />
                <View style={{ flex: 1, backgroundColor: swatch[1] }} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? colors.textPrimary : colors.textSecondary }}>{t(o.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
