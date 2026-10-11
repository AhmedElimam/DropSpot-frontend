import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Share } from 'react-native';
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
import { sendStudentReportWhatsApp } from '@/api/students';
import { getFriendlyErrorMessage } from '@/utils/errors';

/**
 * From the student page: send the student's performance PDF straight into one of that
 * student's open tickets with the parent (founder 2026-10-11: «forward the PDF to the
 * selected ticket from the student profile»). Nothing is downloaded; the parent is notified
 * and opens it in the thread. With no open ticket it goes on WhatsApp instead, at once
 * (founder 2026-10-12): from the business number when that is connected, otherwise the
 * teacher's own WhatsApp opens on the parent's chat with a week-long link to the PDF ready.
 */
export function SendReportSheet({ visible, onClose, studentId, studentName }: { visible: boolean; onClose: () => void; studentId: number; studentName: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useTickets();
  const [busy, setBusy] = useState<string | null>(null);
  const open = (data ?? []).filter((x) => Number(x.student_id) === studentId && x.status !== 'closed');
  const noTicket = !isLoading && open.length === 0;

  const sendWhatsApp = async () => {
    setBusy('whatsapp');
    try {
      const r = await sendStudentReportWhatsApp(studentId);
      onClose();
      if (r.sent) {
        Alert.alert(t('tickets.report_whatsapp_sent_title'), t('tickets.report_whatsapp_sent_body', { name: studentName }));
        return;
      }
      try {
        await Linking.openURL(`https://wa.me/${r.phone}?text=${encodeURIComponent(r.text)}`);
      } catch {
        Alert.alert(t('common.error'), `${t('tickets.report_whatsapp_no_app')}\n${r.url}`, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('tickets.share_link'), onPress: () => { void Share.share({ message: r.text }); } },
        ]);
      }
    } catch (e) {
      onClose();
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  // No ticket to put it in → straight to WhatsApp, once per opening of the sheet.
  const fired = useRef(false);
  useEffect(() => {
    if (!visible) { fired.current = false; return; }
    if (noTicket && !fired.current && !busy) {
      fired.current = true;
      void sendWhatsApp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, noTicket]);

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
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.md }}>{t(noTicket ? 'tickets.send_report_whatsapp' : 'tickets.send_report_pick_hint', { name: studentName })}</Text>
      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : noTicket ? (
        <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{t('tickets.send_report_whatsapp_hint')}</Text>
          {busy === 'whatsapp' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ActivityIndicator color={colors.whatsapp} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{t('tickets.send_report_whatsapp_opening')}</Text>
            </View>
          ) : null}
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
      {!isLoading && !(noTicket && busy === 'whatsapp') ? (
        <TouchableOpacity onPress={sendWhatsApp} disabled={!!busy} activeOpacity={0.8} accessibilityRole="button"
          style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.whatsapp, opacity: busy ? 0.6 : 1 }}>
          {busy === 'whatsapp' ? <ActivityIndicator color={colors.whatsapp} /> : <Icon name="whatsapp" size={18} color={colors.whatsapp} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('tickets.send_report_whatsapp')}</Text>
        </TouchableOpacity>
      ) : null}
    </SheetModal>
  );
}
