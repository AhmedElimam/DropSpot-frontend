import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { chat } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { VoiceRecorder, type VoiceClip } from '@/components/chat/VoiceRecorder';

/**
 * The messenger composer: one rounded pill holding the text field, a paperclip and a camera,
 * with a single circular button beside it that is a MIC while the field is empty and a SEND
 * arrow the moment there is something to send. That swap is the gesture everyone already
 * knows, and it keeps one thumb-sized target in one place instead of three competing ones.
 *
 * While recording, the pill is replaced by the recorder's own running state — there is
 * nothing to type at that moment, and leaving a live text field under a held finger invites
 * half-sent messages.
 */
export function ChatComposer({
  value, onChange, onSend, onAttach, onCamera, onVoiceClip, voiceMaxSeconds,
  sending, recording, onRecordingChange, bottomInset,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onCamera: () => void;
  onVoiceClip: (clip: VoiceClip) => void;
  voiceMaxSeconds: number;
  sending: boolean;
  recording: boolean;
  onRecordingChange: (recording: boolean) => void;
  bottomInset: number;
}) {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm + bottomInset,
        backgroundColor: chat.bar,
        borderTopWidth: 1,
        borderTopColor: chat.barBorder,
      }}
    >
      {recording ? (
        <View style={{ flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>
            {t('chat.record_hint')}
          </Text>
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: colors.surface,
            borderRadius: radius.xxl,
            borderWidth: 1,
            borderColor: chat.barBorder,
            paddingStart: spacing.lg,
            paddingEnd: spacing.sm,
            minHeight: 48,
          }}
        >
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={t('chat.type_message')}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              fontFamily: fonts.regular,
              fontSize: 16,
              lineHeight: 22,
              maxHeight: 120,
              paddingTop: 12,
              paddingBottom: 12,
              color: colors.textPrimary,
              textAlign: 'right',
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 6 }}>
            <TouchableOpacity
              onPress={onAttach}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.attach')}
              style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="attach" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCamera}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.attach_camera')}
              style={{ width: 34, height: 38, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="camera" size={21} color={colors.textSecondary} outline />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {canSend && !recording ? (
        <TouchableOpacity
          onPress={onSend}
          disabled={sending}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={20} color="#fff" />}
        </TouchableOpacity>
      ) : (
        <VoiceRecorder
          maxSeconds={voiceMaxSeconds}
          disabled={sending}
          onClip={onVoiceClip}
          onStateChange={onRecordingChange}
        />
      )}
    </View>
  );
}
