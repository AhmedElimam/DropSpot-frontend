import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useReleaseNotes } from '@/hooks/useReleaseNotes';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatDate } from '@/utils/format';

/** Every published «ما الجديد» for this role, newest first — the history behind the home card. */
export default function WhatsNewScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useReleaseNotes();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const installed = Constants.expoConfig?.version ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('whats_new.title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon="star" title={t('whats_new.empty')} message={t('whats_new.empty_hint')} />
        ) : (
          (data ?? []).map((n) => (
            <View key={n.version} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: n.version === installed ? colors.brand + '55' : colors.border, padding: spacing.lg, ...shadows.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{n.title || t('whats_new.version', { version: n.version })}</Text>
                {n.version === installed ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand }}>{t('whats_new.installed')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                {t('whats_new.version', { version: n.version })}{n.published_at ? ` · ${formatDate(n.published_at)}` : ''}
              </Text>
              <View style={{ marginTop: spacing.md, gap: 6 }}>
                {n.lines.map((line, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.brand }}>•</Text>
                    <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{line}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
