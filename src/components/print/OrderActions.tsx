import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, gradients, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/** «اطلب مرة أخرى» as a delivery app's reorder tile: warm, one tap, the shop named. */
export function OrderReorderTile({ shop, onPress, busy }: { shop?: string | null; onPress: () => void; busy: boolean }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('print.reorder')}
      style={{ borderRadius: radius.xl, ...shadows.md }}>
      <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 72, borderRadius: radius.xl, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -50, end: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: colors.onAccent, opacity: 0.1 }} />
        <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: 15, backgroundColor: colors.onAccent, opacity: 0.2 }} />
          <Icon name="refresh" size={22} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onAccent }}>{t('print.reorder')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.onAccent, opacity: 0.88 }} numberOfLines={1}>
            {shop ? t('print.reorder_sub', { shop }) : t('print.reorder_sub_plain')}
          </Text>
        </View>
        {busy ? <ActivityIndicator color={colors.onAccent} /> : <Icon name="back" size={20} color={colors.onAccent} />}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** «إلغاء الطلب»: quiet on purpose — red words, no fill, so nobody taps it on the way past. */
export function OrderCancelButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('print.cancel')}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.dangerLight, backgroundColor: colors.surface }}>
      {busy ? <ActivityIndicator color={colors.danger} /> : (
        <>
          <Icon name="absent" size={18} color={colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger }}>{t('print.cancel')}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
