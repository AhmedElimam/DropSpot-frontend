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
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useTicket, useAddMessage, useUpdateTicketStatus } from '@/hooks/useTickets';
import { useAuthStore } from '@/stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState } from '@/components/ui/ErrorState';
import { CallTeacherButton } from '@/components/ui/CallTeacherButton';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';

const statusColors: Record<string, [string, string]> = {
  open: ['#6366F1', '#4F46E5'],
  in_progress: ['#F59E0B', '#D97706'],
  resolved: ['#10B981', '#059669'],
  closed: ['#6B7280', '#4B5563'],
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
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginEnd: spacing.md }}>
              <Icon name="forward" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff' }} numberOfLines={1}>
                {ticket.subject}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {ticket.student_name} - {ticket.teacher_name}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View
              style={{
                backgroundColor: sc[0] + '30',
                borderRadius: radius.sm,
                paddingVertical: 3,
                paddingHorizontal: spacing.sm,
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff' }}>
                {t(`tickets.status_${ticket.status}`)}
              </Text>
            </View>

            {!isParent && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
              <TouchableOpacity
                onPress={() => handleStatusChange('resolved')}
                style={{
                  backgroundColor: 'rgba(16,185,129,0.3)',
                  borderRadius: radius.sm,
                  paddingVertical: 3,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff' }}>
                  {t('tickets.mark_resolved')}
                </Text>
              </TouchableOpacity>
            )}

            {ticket.status === 'resolved' && (
              <TouchableOpacity
                onPress={() => handleStatusChange('closed')}
                style={{
                  backgroundColor: 'rgba(107,114,128,0.3)',
                  borderRadius: radius.sm,
                  paddingVertical: 3,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff' }}>
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
                  maxWidth: '80%',
                  backgroundColor: isMine ? '#6366F1' : colors.white,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  ...(isMine ? {} : shadows.sm),
                  borderBottomEndRadius: isMine ? 4 : radius.lg,
                  borderBottomStartRadius: isMine ? radius.lg : 4,
                }}
              >
                {!isMine && (
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 11,
                      color: colors.primary,
                      marginBottom: 4,
                    }}
                  >
                    {msg.user_name}
                  </Text>
                )}
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 14,
                    color: isMine ? '#fff' : colors.textPrimary,
                  }}
                >
                  {msg.message}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.regular,
                    fontSize: 10,
                    color: isMine ? 'rgba(255,255,255,0.5)' : colors.textTertiary,
                    marginTop: 4,
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
            <View style={{ alignSelf: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.dangerText, textAlign: 'center' }}>
                {getFriendlyErrorMessage(addMessage.error)}
              </Text>
            </View>
          )}

          {ticket.teacher_phone ? (
            <CallTeacherButton
              phone={ticket.teacher_phone}
              name={ticket.teacher_name}
              style={{ alignSelf: 'center', marginTop: spacing.md }}
            />
          ) : null}
        </ScrollView>

        {/* Input */}
        {ticket.status !== 'closed' && (
          <View
            style={{
              flexDirection: 'row',
              padding: spacing.md,
              paddingBottom: spacing.md + insets.bottom,
              backgroundColor: colors.white,
              borderTopWidth: 1,
              borderTopColor: colors.borderLight,
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
                fontSize: 15,
                backgroundColor: colors.background,
                borderRadius: radius.md,
                padding: 12,
                color: colors.textPrimary,
                textAlign: 'right',
                maxHeight: 100,
              }}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!newMessage.trim() || addMessage.isPending}
              activeOpacity={0.7}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: newMessage.trim() ? colors.primary : colors.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {addMessage.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
