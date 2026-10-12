import { useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { chat, senderColor } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { SEND_FLIP, useVoiceRecorder, type VoiceClip } from '@/components/chat/VoiceRecorder';
import type { ChatReplyRef } from '@/api/chat';

/**
 * The composer: a bordered surface field carrying the attach and camera actions, with one
 * action beside it that is a MIC while the field is empty and a SEND arrow the moment there
 * is something to send. Same tokens as every other input in the app — surface,
 * `colors.border`, `radius.lg` — so it reads as this product's field, not a messenger's pill.
 *
 * While recording, the recorder's running bar is drawn OVER the field (absoluteFill — no
 * left/right for forced RTL to flip). The field stays mounted underneath, invisible: had it
 * unmounted, an open keyboard would drop mid-hold and slide the button out from under the
 * finger.
 */
export function ChatComposer({
  value, onChange, onSend, onAttach, onCamera, onVoiceClip, voiceMaxSeconds,
  sending, onRecordingChange, bottomInset, replyTo, onCancelReply, myId,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onCamera: () => void;
  onVoiceClip: (clip: VoiceClip) => void;
  voiceMaxSeconds: number;
  sending: boolean;
  onRecordingChange?: (recording: boolean) => void;
  bottomInset: number;
  /** Swipe-to-reply: the message being answered, quoted above the field until sent or closed. */
  replyTo?: ChatReplyRef | null;
  onCancelReply?: () => void;
  myId?: number;
}) {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0;
  const voice = useVoiceRecorder({ maxSeconds: voiceMaxSeconds, disabled: sending, onClip: onVoiceClip, onStateChange: onRecordingChange });
  // A swipe to reply puts the cursor in the field, like WhatsApp.
  const input = useRef<TextInput>(null);
  useEffect(() => { if (replyTo) input.current?.focus(); }, [replyTo?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const replyColor = replyTo ? (replyTo.sender_id === myId ? colors.brand : senderColor(replyTo.sender_id)) : colors.brand;

  return (
    <View style={{ backgroundColor: chat.bar, borderTopWidth: 1, borderTopColor: chat.barBorder }}>
    {replyTo ? (
      <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.sm, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSunken, borderStartWidth: 3, borderStartColor: replyColor }}>
        <Icon name="reply" size={16} color={replyColor} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12.5, color: replyColor, textAlign: 'right' }}>
            {t('chat.replying_to', { name: replyTo.sender_id === myId ? t('chat.you') : replyTo.sender_name })}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, textAlign: 'right' }}>{replyTo.preview ?? t('chat.reply_hidden')}</Text>
        </View>
        <TouchableOpacity onPress={onCancelReply} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('chat.cancel_reply')}
          style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>
    ) : null}
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.md + bottomInset,
      }}
    >
      <View style={{ flex: 1, minHeight: 52 }}>
        <View
          pointerEvents={voice.active ? 'none' : 'auto'}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: colors.surfaceSunken,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            paddingStart: spacing.lg,
            paddingEnd: spacing.xs,
            minHeight: 52,
            opacity: voice.active ? 0 : 1,
          }}
        >
          <TextInput
            ref={input}
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
        {voice.bar ? <View style={[StyleSheet.absoluteFillObject, { flexDirection: 'row' }]}>{voice.bar}</View> : null}
      </View>

      {canSend && !voice.active ? (
        <Animated.View entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(100)}>
        <TouchableOpacity
          onPress={onSend}
          disabled={sending}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="send" size={20} color="#fff" style={SEND_FLIP} />}
        </TouchableOpacity>
        </Animated.View>
      ) : voice.button}
    </View>
    </View>
  );
}
