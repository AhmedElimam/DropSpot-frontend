import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { Surface } from '@/ui/surfaces';
import { getDataExportUrl, type ExportDataset } from '@/api/dataExport';
import { openRemoteFile } from '@/utils/openPdf';
import { getFriendlyErrorMessage } from '@/utils/errors';

const FILES: { key: ExportDataset; icon: IconName }[] = [
  { key: 'students', icon: 'children' },
  { key: 'groups', icon: 'book' },
  { key: 'attendance', icon: 'calendar' },
  { key: 'bills', icon: 'invoices' },
  { key: 'expenses', icon: 'money' },
];

/**
 * «تصدير بياناتي» (founder 2026-11-05): everything the teacher has on Dros Spot, as files that
 * open in Excel — one per area, or all of them in one ZIP. Each tap asks for a 10-minute
 * signed link, downloads it and hands it to the share sheet. Teacher only.
 */
export default function DataExportScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<ExportDataset | null>(null);

  const get = async (key: ExportDataset) => {
    if (busy) return;
    setBusy(key);
    try {
      const { url, filename } = await getDataExportUrl(key);
      await openRemoteFile(url, filename, key === 'all'
        ? { ext: 'zip', mimeType: 'application/zip', UTI: 'public.zip-archive' }
        : { ext: 'csv', mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const row = (key: ExportDataset, icon: IconName, sub: string, strong = false) => (
    <Surface key={key} id={`teacher.data_export.row_${key}`}>
    <TouchableOpacity onPress={() => get(key)} disabled={!!busy} activeOpacity={0.85} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.xl,
        backgroundColor: strong ? colors.brand : colors.surface, borderWidth: strong ? 0 : 1, borderColor: colors.border, opacity: busy && busy !== key ? 0.5 : 1 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: strong ? 'rgba(255,255,255,0.18)' : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={strong ? colors.onPrimary : colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: strong ? colors.onPrimary : colors.textPrimary }}>{t(`data_export.${key}`)}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: strong ? colors.onPrimary : colors.textSecondary, marginTop: 2 }}>{sub}</Text>
      </View>
      {busy === key ? <ActivityIndicator color={strong ? colors.onPrimary : colors.brand} /> : <Icon name="download" size={20} color={strong ? colors.onPrimary : colors.textTertiary} />}
    </TouchableOpacity>
    </Surface>
  );

  return (
    <Surface id="screen.teacher.data-export" screen>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('data_export.title')}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md }}>{t('data_export.intro')}</Text>
        {row('all', 'download', t('data_export.all_sub'), true)}
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm }}>{t('data_export.one_file')}</Text>
        {FILES.map((f) => row(f.key, f.icon, t('data_export.csv_sub')))}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight }}>
          <Icon name="lock" size={16} color={colors.warning} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textPrimary }}>{t('data_export.privacy')}</Text>
        </View>
      </ScrollView>
    </View>
    </Surface>
  );
}
