import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { openRemotePdf } from '@/utils/openPdf';
import { NazerStamp } from './NazerStamp';

export interface NazerReportItem {
  key: string;
  name: string;
  /** Mints the 5-minute signed link to the stamped PDF. */
  url: () => Promise<string>;
}

/**
 * «تقارير بختم الناظر» in his office (founder 2026-10-22): the student's report as a PDF he
 * stamps — his crest, the revision number and a credential to check at /v, like مدام روز's
 * documents. One row per child for a parent; the student's own for a student.
 */
export function NazerReportsCard({ items }: { items: NazerReportItem[] }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  if (items.length === 0) return null;

  const open = async (item: NazerReportItem) => {
    if (busy) return;
    setBusy(item.key);
    try {
      const url = await item.url();
      await openRemotePdf(url, t('nazer.report_file', { name: item.name }));
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <NazerStamp kind="approved" size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{t('nazer.reports_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{t('nazer.reports_sub')}</Text>
        </View>
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {items.map((item) => (
          <TouchableOpacity key={item.key} onPress={() => open(item)} disabled={!!busy} activeOpacity={0.85} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, opacity: busy && busy !== item.key ? 0.5 : 1 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="reports" size={18} color={colors.brand} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{t('nazer.report_of', { name: item.name })}</Text>
            {busy === item.key ? <ActivityIndicator color={colors.brand} /> : <Icon name="download" size={18} color={colors.brand} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
