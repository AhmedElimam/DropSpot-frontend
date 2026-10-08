import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTutorials } from '@/hooks/useTutorials';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatNumber } from '@/utils/format';

/**
 * «شروحات التطبيق» (founder 2026-10-08: «an educational video of everything in the app, in
 * the current UI, opened from a link, to make onboarding easier — teacher side first»). One
 * card per chapter, in order; a tap plays it full screen. The list comes from the server, so
 * a new or re-recorded chapter appears without an app update.
 */
export default function TutorialsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useTutorials();
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const list = data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={[...gradients.auth]} style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#FFFFFF', marginTop: spacing.md }}>{t('tutorials.title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, lineHeight: 22 }}>{t('tutorials.hero_sub')}</Text>
      </LinearGradient>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : list.length === 0 ? (
          <EmptyState icon="play" title={isError ? t('tutorials.load_failed') : t('tutorials.empty')} message={t('tutorials.empty_hint')} />
        ) : (
          list.map((c) => (
            <TouchableOpacity key={c.key} activeOpacity={0.85} accessibilityRole="button"
              onPress={() => router.push(`/(teacher)/tutorial/${c.key}` as Href)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, ...shadows.sm }}>
              <View style={{ width: 62, height: 110, borderRadius: radius.md, overflow: 'hidden', backgroundColor: gradients.auth[1], alignItems: 'center', justifyContent: 'center' }}>
                {c.poster ? <Image source={{ uri: c.poster }} style={{ position: 'absolute', width: 62, height: 110 }} contentFit="cover" /> : null}
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,14,39,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={18} color="#FFFFFF" />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.accent }}>{t('tutorials.chapter', { n: formatNumber(c.number) })}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, marginTop: 2 }}>{c.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 20 }}>{c.sub}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{t('tutorials.size', { mb: formatNumber(c.mb) })}</Text>
              </View>
              <Icon name="back" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
