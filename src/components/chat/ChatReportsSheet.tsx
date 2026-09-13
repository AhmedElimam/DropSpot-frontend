import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useResolveChatReport } from '@/hooks/useChat';
import { getFriendlyErrorMessage } from '@/utils/errors';
import type { ChatReport, ChatReportAction } from '@/api/chat';

/**
 * The teacher's report queue for one room (§5) — the same five answers the web room and the
 * ops backstop offer, so a report can be dealt with from whichever screen the teacher has
 * open. A report that can only be answered at a desk is a report that ages past the SLA.
 *
 * Two things the sheet must show and does: the message AS IT WAS when reported (kept by the
 * server, so a sender deleting it changes nothing), and how long it has been waiting. The
 * reporter's name is shown to staff only — it is never returned to the reported student.
 */
export function ChatReportsSheet({
  visible, onClose, courseId, reports, muteMaxHours, loading,
}: {
  visible: boolean;
  onClose: () => void;
  courseId: number;
  reports: ChatReport[];
  muteMaxHours: number;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const resolve = useResolveChatReport(courseId);
  const [active, setActive] = useState<ChatReport | null>(null);
  const [note, setNote] = useState('');

  const act = (report: ChatReport, action: ChatReportAction) => {
    const payload: { reportId: number; action: ChatReportAction; note?: string; hours?: number; reason?: string } = {
      reportId: report.id,
      action,
      note: note.trim() || undefined,
    };
    if (action === 'mute') {
      payload.hours = 24;
      payload.reason = note.trim() || report.reason_label;
    }
    resolve.mutate(payload, {
      onSuccess: () => { setActive(null); setNote(''); },
      onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)),
    });
  };

  const confirmAct = (report: ChatReport, action: ChatReportAction) => {
    // Escalation leaves the chat entirely and becomes a real incident on the student's
    // record — never one tap away by accident.
    if (action === 'escalate') {
      Alert.alert(t('chat.action_escalate'), t('chat.escalate_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.escalate_action'), style: 'destructive', onPress: () => act(report, action) },
      ]);
      return;
    }
    act(report, action);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, maxHeight: '88%', paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>
              {t('chat.reports_title')}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
            ) : reports.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl4 }}>
                <Icon name="success" size={40} color={colors.success} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginTop: spacing.md }}>
                  {t('chat.reports_empty')}
                </Text>
              </View>
            ) : (
              reports.map((r) => {
                const open = active?.id === r.id;
                return (
                  <View
                    key={r.id}
                    style={{
                      borderWidth: 1, borderColor: r.late ? colors.danger : colors.border,
                      backgroundColor: r.late ? colors.dangerLight : colors.surfaceSunken,
                      borderRadius: radius.lg, padding: spacing.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }}>{r.reason_label}</Text>
                      </View>
                      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: r.late ? colors.dangerText : colors.textTertiary }}>
                        {t('chat.report_age', { hours: r.age_hours })}{r.late ? ` · ${t('chat.report_late')}` : ''}
                      </Text>
                    </View>

                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right', marginTop: spacing.sm }}>
                      {r.reported_user?.name ?? t('chat.report_about_room')}
                    </Text>

                    {r.captured_body ? (
                      <View style={{ borderStartWidth: 3, borderStartColor: colors.border, paddingStart: spacing.sm, marginTop: 4 }}>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'right' }} numberOfLines={open ? undefined : 3}>
                          {r.captured_body}
                        </Text>
                      </View>
                    ) : null}
                    {r.note ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'right', marginTop: 4 }}>
                        {r.note}
                      </Text>
                    ) : null}
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, textAlign: 'right', marginTop: 4 }}>
                      {t('chat.reported_by', { name: r.reporter.name ?? '—' })}
                    </Text>

                    {!open ? (
                      <TouchableOpacity
                        onPress={() => { setActive(r); setNote(''); }}
                        style={{ marginTop: spacing.md, minHeight: 42, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('chat.handle')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                        <TextInput
                          value={note}
                          onChangeText={setNote}
                          placeholder={t('chat.handle_note')}
                          placeholderTextColor={colors.textTertiary}
                          maxLength={1000}
                          multiline
                          style={{ fontFamily: fonts.regular, fontSize: 14, minHeight: 54, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.textPrimary, textAlign: 'right' }}
                        />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                          <ActionChip label={t('chat.action_dismiss')} onPress={() => confirmAct(r, 'dismiss')} disabled={resolve.isPending} />
                          <ActionChip label={t('chat.action_warn')} onPress={() => confirmAct(r, 'warn')} disabled={resolve.isPending || !r.reported_user} />
                          <ActionChip label={t('chat.action_remove')} onPress={() => confirmAct(r, 'remove')} disabled={resolve.isPending || !r.message_id} />
                          <ActionChip label={t('chat.action_mute', { hours: 24 })} onPress={() => confirmAct(r, 'mute')} disabled={resolve.isPending || !r.reported_user} tone="warn" />
                          <ActionChip label={t('chat.action_escalate')} onPress={() => confirmAct(r, 'escalate')} disabled={resolve.isPending || !r.reported_user} tone="danger" />
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 18, color: colors.textTertiary, textAlign: 'right' }}>
                          {t('chat.handle_hint', { max: muteMaxHours })}
                        </Text>
                        <TouchableOpacity onPress={() => setActive(null)} style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary }}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActionChip({ label, onPress, disabled, tone }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'warn' | 'danger' }) {
  const border = tone === 'danger' ? colors.danger : tone === 'warn' ? colors.warning : colors.borderStrong;
  const text = tone === 'danger' ? colors.dangerText : tone === 'warn' ? colors.warningText : colors.textPrimary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: border, backgroundColor: colors.surface, opacity: disabled ? 0.45 : 1 }}
    >
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: text }}>{label}</Text>
    </TouchableOpacity>
  );
}
