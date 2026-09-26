import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useWhatsNew } from '@/hooks/useReleaseNotes';

/**
 * «ما الجديد» on the home screen, once per installed version, in this role's words. The
 * text is written and published at /admin/release-notes — no build needed. Closing it is
 * remembered; «كل التحديثات» opens the full history.
 */
export function WhatsNewCard() {
  const { t } = useTranslation();
  const { note, dismiss } = useWhatsNew();
  if (!note || note.lines.length === 0) return null;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brand + '44', padding: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="star" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{note.title || t('whats_new.title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('whats_new.version', { version: note.version })}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={10}
          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={{ marginTop: spacing.md, gap: 6 }}>
        {note.lines.map((line, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.brand }}>•</Text>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{line}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={() => router.push('/whats-new' as never)} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('whats_new.all')}</Text>
      </TouchableOpacity>
    </View>
  );
}
