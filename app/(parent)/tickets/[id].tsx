import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav, gradients } from '@/theme/index';
import { useTicket, useAddMessage, useUpdateTicketStatus } from '@/hooks/useTickets';
import { useAuthStore } from '@/stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '@/components/ui/ErrorState';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';

// Status accent on the Sanad ink/semantic ramp (used for the header pill tint).
const statusColors: Record<string, [string, string]> = {
  open: [colors.brand, colors.brandDeep],
  in_progress: [colors.warning, colors.warningDark],
  resolved: [colors.success, colors.successDark],
  closed: [colors.textTertiary, colors.textSecondary],
};

export default function TicketDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: ticket, isLoading, refetch } = useTicket(id ?? '');
  const addMessage = useAddMessage(id ?? '');
  const updateStatus = useUpdateTicketStatus(id ?? '');
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (ticket?.messages?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [ticket?.messages?.length]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    addMessage.mutate(newMessage.trim(), {
      onSuccess: () => {
        setNewMessage('');
      },
    });
  };

  const handleStatusChange = (status: string) => {
    updateStatus.mutate(status);
  };

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

  const sc = statusColors[ticket.status] || statusColors.open;
  const isParent = user?.user_type_id === 4;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <TouchableOpacity onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', marginEnd: spacing.sm }}>
              <Icon name="forward" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff' }} numberOfLines={1}>
                {ticket.subject}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
                {ticket.student_name} - {ticket.teacher_name}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.16)',
                borderRadius: radius.full,
                paddingVertical: 5,
                paddingHorizontal: spacing.md,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ticket.status === 'open' ? '#fff' : sc[0] }} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                {t(`tickets.status_${ticket.status}`)}
              </Text>
            </View>

            {!isParent && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
              <TouchableOpacity
                onPress={() => handleStatusChange('resolved')}
                activeOpacity={0.75}
                style={{
                  minHeight: 34,
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderRadius: radius.full,
                  paddingVertical: 5,
                  paddingHorizontal: spacing.md,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                  {t('tickets.mark_resolved')}
                </Text>
              </TouchableOpacity>
            )}

            {ticket.status === 'resolved' && (
              <TouchableOpacity
                onPress={() => handleStatusChange('closed')}
                activeOpacity={0.75}
                style={{
                  minHeight: 34,
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderRadius: radius.full,
                  paddingVertical: 5,
                  paddingHorizontal: spacing.md,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                  {t('tickets.close')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Messages */}
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
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 13,
                      color: colors.brand,
                      marginBottom: 4,
                    }}
                  >
                    {msg.user_name}
                  </Text>
                )}
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 16,
                    lineHeight: 24,
                    color: isMine ? '#fff' : colors.textPrimary,
                  }}
                >
                  {msg.message}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 12,
                    color: isMine ? 'rgba(255,255,255,0.6)' : colors.textTertiary,
                    marginTop: 6,
                    alignSelf: 'flex-end',
                  }}
                >
                  {new Date(msg.created_at).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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

        {/* Input */}
        {ticket.status !== 'closed' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              padding: spacing.md,
              paddingBottom: spacing.md + insets.bottom,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: spacing.sm,
            }}
          >
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={t('tickets.type_message')}
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{
                flex: 1,
                fontFamily: fonts.regular,
                fontSize: 17,
                lineHeight: 24,
                minHeight: 52,
                maxHeight: 120,
                backgroundColor: colors.surfaceSunken,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: 14,
                color: colors.textPrimary,
                textAlign: 'right',
              }}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!newMessage.trim() || addMessage.isPending}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: newMessage.trim() ? colors.brand : colors.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {addMessage.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
