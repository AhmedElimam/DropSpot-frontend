import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { formatTime } from '@/utils/format';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { useTicket, useAddMessage, useUpdateTicketStatus, useSendStudentReport } from '@/hooks/useTickets';
import type { PendingFile } from '@/api/tickets';
import { AttachButton, MessageAttachments, PendingFiles } from '@/components/tickets/Attachments';
import { Alert } from '@/ui/dialog';
import { useAuthStore } from '@/stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '@/components/ui/ErrorState';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';
import { useKeyboardShown } from '@/hooks/useKeyboardShown';
import { Surface } from '@/ui/surfaces';

const statusColors = (): Record<string, [string, string]> => ({
  open: [colors.brand, colors.brandDeep],
  in_progress: [colors.warning, colors.warningDark],
  resolved: [colors.success, colors.successDark],
  closed: [colors.textTertiary, colors.textSecondary],
});

// Teacher/assistant ticket thread. Status controls (resolve/close) are active for
// staff (isParent === false). An assistant reply is audit-logged on-behalf-of the
// owning teacher server-side.
export default function TeacherTicketDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const keyboardShown = useKeyboardShown();
  const user = useAuthStore((s) => s.user);
  const { data: ticket, isLoading, refetch } = useTicket(id ?? '');
  const addMessage = useAddMessage(id ?? '');
  const updateStatus = useUpdateTicketStatus(id ?? '');
  const [newMessage, setNewMessage] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const sendReport = useSendStudentReport(id ?? '');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (ticket?.messages?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [ticket?.messages?.length]);

  const canSend = !!newMessage.trim() || files.length > 0;
  const handleSend = () => {
    if (!canSend) return;
    addMessage.mutate({ message: newMessage.trim(), files }, { onSuccess: () => { setNewMessage(''); setFiles([]); } });
  };
  // The student's performance report, into the thread — no download on either side.
  const handleReport = () => {
    Alert.alert(t('tickets.send_report'), t('tickets.send_report_confirm', { name: ticket?.student_name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('tickets.send_report_do'), onPress: () => sendReport.mutate(undefined, { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) }) },
    ]);
  };

  const handleStatusChange = (status: string) => updateStatus.mutate(status);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  const sc = statusColors()[ticket.status] || statusColors().open;

  return (
    <Surface id="screen.teacher.tickets.detail" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        // No navigation header sits above this screen — its own hero is inside — so there is
        // nothing to offset. The old 90 was a header that no longer exists: empty space.
        keyboardVerticalOffset={0}
      >
        <Surface id="teacher.tickets.detail.hero">
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <TouchableOpacity onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', marginEnd: spacing.sm }}>
              <Icon name="forward" size={26} color={colors.onHero} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.onHero }} numberOfLines={1}>
                {ticket.subject}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.onHeroSoft, marginTop: 2 }}>
                {ticket.student_name}{ticket.parent_name ? ` · ${ticket.parent_name}` : ''}
              </Text>
            </View>
          </View>

          <Surface id="teacher.tickets.detail.status_row">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Surface id="teacher.tickets.detail.status_chip">
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder,
                borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: spacing.md,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ticket.status === 'open' ? colors.onHero : sc[0] }} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onHero }}>{t(`tickets.status_${ticket.status}`)}</Text>
            </View>
            </Surface>

            {/* Changing status is part of reply_tickets («الرد على التذاكر وتغيير حالتها»). */}
            <Surface id="teacher.tickets.detail.mark_resolved" assistantNeeds="reply_tickets">
            {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
              <TouchableOpacity
                onPress={() => handleStatusChange('resolved')}
                activeOpacity={0.75}
                style={{ minHeight: 34, justifyContent: 'center', backgroundColor: colors.onHeroChip, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: spacing.md }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onHero }}>{t('tickets.mark_resolved')}</Text>
              </TouchableOpacity>
            )}
            </Surface>

            <Surface id="teacher.tickets.detail.close" assistantNeeds="reply_tickets">
            {ticket.status === 'resolved' && (
              <TouchableOpacity
                onPress={() => handleStatusChange('closed')}
                activeOpacity={0.75}
                style={{ minHeight: 34, justifyContent: 'center', backgroundColor: colors.onHeroChip, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: spacing.md }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onHero }}>{t('tickets.close')}</Text>
              </TouchableOpacity>
            )}
            </Surface>
          </View>
          </Surface>
        </LinearGradient>
        </Surface>

        <Surface id="teacher.tickets.detail.thread">
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {ticket.messages?.map((msg) => {
            const isMine = msg.user_id === user?.id;
            return (
              <View
                key={msg.id}
                style={{
                  alignSelf: isMine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  backgroundColor: isMine ? colors.brand : colors.surface,
                  borderWidth: isMine ? 0 : 1,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  ...(isMine ? {} : shadows.sm),
                  borderBottomEndRadius: isMine ? 4 : radius.xl,
                  borderBottomStartRadius: isMine ? radius.xl : 4,
                }}
              >
                {!isMine && (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand, marginBottom: 4 }}>
                    {msg.user_name}
                  </Text>
                )}
                {msg.message ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: isMine ? '#fff' : colors.textPrimary }}>
                    {msg.message}
                  </Text>
                ) : null}
                <MessageAttachments items={msg.attachments} onDark={isMine} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: isMine ? 'rgba(255,255,255,0.6)' : colors.textTertiary, marginTop: 6, alignSelf: 'flex-end' }}>
                  {formatTime(msg.created_at)}
                </Text>
              </View>
            );
          })}
          {addMessage.isError && (
            <View style={{ alignSelf: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.dangerText, textAlign: 'center' }}>
                {getFriendlyErrorMessage(addMessage.error)}
              </Text>
            </View>
          )}
        </ScrollView>
        </Surface>

        {/* Without reply_tickets there is no reply box and no "locked" notice — just the thread
            (the fallback keeps the safe-area spacer under it). */}
        <Surface id="teacher.tickets.detail.reply_box" assistantNeeds="reply_tickets" fallback={ticket.status !== 'closed' ? <View style={{ height: insets.bottom }} /> : null}>
        {ticket.status !== 'closed' ? (
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
          {ticket.can_send_report ? (
            <Surface id="teacher.tickets.detail.send_report">
            <TouchableOpacity onPress={handleReport} disabled={sendReport.isPending} activeOpacity={0.8} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginHorizontal: spacing.md, marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.accentWarmTint, borderWidth: 1, borderColor: colors.accentWarm }}>
              {sendReport.isPending ? <ActivityIndicator size="small" color={colors.accentWarm} /> : <Icon name="reports" size={16} color={colors.accentWarm} />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.accentText }}>{t('tickets.send_report')}</Text>
            </TouchableOpacity>
            </Surface>
          ) : null}
          <PendingFiles files={files} onRemove={(uri) => setFiles((f) => f.filter((x) => x.uri !== uri))} />
          <View
            style={{
              flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md,
              paddingBottom: spacing.md + (keyboardShown ? 0 : insets.bottom), gap: spacing.sm,
            }}
          >
            <Surface id="teacher.tickets.detail.attach_button">
            <AttachButton files={files} onAdd={(f) => setFiles((cur) => [...cur, f])} disabled={addMessage.isPending} />
            </Surface>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={t('tickets.type_message')}
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{
                flex: 1, fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, minHeight: 52, maxHeight: 120,
                backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderStrong,
                borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 14, color: colors.textPrimary, textAlign: 'right',
              }}
            />
            <Surface id="teacher.tickets.detail.send_button">
            <TouchableOpacity
              onPress={handleSend}
              disabled={!canSend || addMessage.isPending}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: canSend ? colors.brand : colors.border, justifyContent: 'center', alignItems: 'center' }}
            >
              {addMessage.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={20} color="#fff" />}
            </TouchableOpacity>
            </Surface>
          </View>
          </View>
        ) : null}
        </Surface>
      </KeyboardAvoidingView>
    </View>
    </Surface>
  );
}
