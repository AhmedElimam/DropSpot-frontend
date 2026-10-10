import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { Alert } from '@/ui/dialog';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { getRoseReportUrl, type RoseReportSection } from '@/api/cash';
import { openRemotePdf } from '@/utils/openPdf';

/**
 * «تصدير PDF» on her desk (founder 2026-10-08: «on her tab I want everything to be exportable
 * to PDF with her stamps»). Asks the server for a fresh five-minute signed link to the section
 * on screen (or the whole desk), then downloads and shares it — the same flow as the insights
 * and performance PDFs, which is what works on Samsung's download manager.
 */
export function useRoseExport() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<RoseReportSection | null>(null);
  const exportPdf = useCallback(async (section: RoseReportSection, period: { week?: string; month?: string } = {}) => {
    if (busy) return;
    setBusy(section);
    try {
      const url = await getRoseReportUrl({ section, ...period });
      await openRemotePdf(url, `${t('cash.export_file')}-${t(`cash.export_name_${section}`)}`);
    } catch {
      Alert.alert(t('common.error'), t('cash.export_failed'));
    } finally {
      setBusy(null);
    }
  }, [busy, t]);
  return { busy, exportPdf };
}

/** A small «PDF» pill for a section's corner. */
export function ExportPill({ onPress, busy, label, style }: { onPress: () => void; busy: boolean; label?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label ?? t('cash.export_pdf')}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface }, style]}>
      {busy ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name="download" size={14} color={colors.brand} />}
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{label ?? t('cash.export_pdf')}</Text>
    </TouchableOpacity>
  );
}
