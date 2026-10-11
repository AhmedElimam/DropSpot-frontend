import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { SheetModal } from '@/components/ui/SheetModal';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { formatDayDate } from '@/utils/format';
import { useTickets } from '@/hooks/useTickets';
import { sendStudentReport } from '@/api/tickets';
import { getFriendlyErrorMessage } from '@/utils/errors';

/**
 * From the student page: send the student's performance PDF straight into one of that
 * student's open tickets with the parent (founder 2026-10-11: «forward the PDF to the
 * selected ticket from the student profile»). Nothing is downloaded; the parent is notified
 * and opens it in the thread. Only parents start tickets, so a student without one says so.
 */
export function SendReportSheet({ visible, onClose, studentId, studentName }: { visible: boolean; onClose: () => void; studentId: number; studentName: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useTickets();
  const [busy, setBusy] = useState<string | null>(null);
  const open = (data ?? []).filter((x) => Number(x.student_id) === studentId && x.status !== 'closed');

  const send = async (ticketId: string) => {
    setBusy(ticketId);
    try {
      await sendStudentReport(ticketId);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      onClose();
      Alert.alert(t('tickets.report_sent_title'), t('tickets.report_sent_body', { name: studentName }), [
        { text: t('common.ok'), style: 'cancel' },
        { text: t('tickets.open_ticket'), onPress: () => router.push(`/(teacher)/tickets/${ticketId}` as Href) },
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SheetModal visible={visible} onClose={() => !busy && onClose()} style={{ backgroundColor: colors.surface, padding: spacing.lg, maxHeight: '80%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="reports" size={20} color={colors.accentWarm} />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('tickets.send_report_pick')}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md }}>{t('tickets.send_report_pick_hint', { name: studentName })}</Text>
      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : open.length === 0 ? (
        <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.lg }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{t('tickets.no_open_ticket_for_student')}</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {open.map((x) => (
            <TouchableOpacity key={x.id} onPress={() => send(x.id)} disabled={!!busy} activeOpacity={0.8} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{x.subject}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
                  {[x.parent_name, t(`tickets.status_${x.status}`), x.last_message_at ? formatDayDate(new Date(x.last_message_at)) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {busy === x.id ? <ActivityIndicator color={colors.brand} /> : <Icon name="send" size={18} color={colors.brand} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SheetModal>
  );
}
