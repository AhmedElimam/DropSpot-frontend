import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { chat } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { VoiceRecorder, type VoiceClip } from '@/components/chat/VoiceRecorder';

/**
 * The composer: a bordered surface field carrying the attach and camera actions, with one
 * circular action beside it that is a MIC while the field is empty and a SEND arrow the
 * moment there is something to send. Same tokens as every other input in the app — surface,
 * `colors.border`, `radius.lg` — so it reads as this product's field, not a messenger's pill.
 *
 * While recording, the field is replaced by the recorder's running state: there is nothing
 * to type at that moment, and a live text field under a held finger invites half-sent
 * messages.
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
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.md + bottomInset,
        backgroundColor: chat.bar,
        borderTopWidth: 1,
        borderTopColor: chat.barBorder,
      }}
    >
      {recording ? (
        // The recorder draws its live bar (clock, level, cancel/lock hints) over this slot.
        <View style={{ flex: 1, minHeight: 52 }} />
      ) : (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: colors.surfaceSunken,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            paddingStart: spacing.lg,
            paddingEnd: spacing.xs,
            minHeight: 52,
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
              lineHeight: 23,
              maxHeight: 120,
              paddingTop: 14,
              paddingBottom: 14,
              color: colors.textPrimary,
              textAlign: 'right',
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 7 }}>
            <TouchableOpacity
              onPress={onAttach}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.attach')}
              style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="attach" size={21} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCamera}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.attach_camera')}
              style={{ width: 34, height: 38, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="camera" size={20} color={colors.textSecondary} outline />
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
          style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}
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
