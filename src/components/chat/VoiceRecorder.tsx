import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, type GestureResponderEvent } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

export interface VoiceClip {
  uri: string;
  /** Seconds, rounded. */
  duration: number;
  mime: string;
  name: string;
}

/**
 * Hold-to-record, release-to-send, slide up to cancel — the gesture every student already
 * knows. The cap comes from the server (§8); recording stops itself at the limit.
 *
 * The clip is handed to the parent, which uploads it through the same door as any other
 * attachment — so a muted student's recording is refused exactly like their typing.
 */
export function VoiceRecorder({ maxSeconds, disabled, onClip, onStateChange }: {
  maxSeconds: number;
  disabled?: boolean;
  onClip: (clip: VoiceClip) => void;
  onStateChange?: (recording: boolean) => void;
}) {
  const { t } = useTranslation();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [holding, setHolding] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const startY = useRef(0);
  const cancelRef = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seconds = Math.round((state.durationMillis || 0) / 1000);

  useEffect(() => { onStateChange?.(holding); }, [holding, onStateChange]);

  const begin = async (e: GestureResponderEvent) => {
    if (disabled) return;
    startY.current = e.nativeEvent.pageY;
    cancelRef.current = false;
    setCancelArmed(false);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('', t('chat.mic_denied')); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setHolding(true);
      // Hard stop at the cap, then send whatever was captured.
      stopTimer.current = setTimeout(() => { void finish(); }, maxSeconds * 1000);
    } catch {
      Alert.alert('', t('chat.mic_denied'));
    }
  };

  const move = (e: GestureResponderEvent) => {
    if (!holding) return;
    const dy = startY.current - e.nativeEvent.pageY;
    const armed = dy > 60;
    cancelRef.current = armed;
    if (armed !== cancelArmed) setCancelArmed(armed);
  };

  const finish = async () => {
    if (stopTimer.current) { clearTimeout(stopTimer.current); stopTimer.current = null; }
    if (!holding && !state.isRecording) return;
    setHolding(false);
    let uri: string | null = null;
    const dur = Math.round((recorder.currentTime || state.durationMillis / 1000 || 0));
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch { /* ignore */ }
    try { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }); } catch { /* ignore */ }

    if (cancelRef.current || !uri) return;
    if (dur < 1) { Alert.alert('', t('chat.recording_too_short')); return; }
    const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
    const mime = ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : ext === 'caf' ? 'audio/x-caf' : ext === '3gp' ? 'audio/3gpp' : ext === 'webm' ? 'audio/webm' : 'audio/mp4';
    onClip({ uri, duration: Math.min(dur, maxSeconds), mime, name: `voice.${ext}` });
  };

  return (
    <View style={{ alignItems: 'center' }}>
      {holding ? (
        <View style={{ position: 'absolute', bottom: 60, alignItems: 'center', backgroundColor: cancelArmed ? colors.dangerLight : colors.surface, borderWidth: 1, borderColor: cancelArmed ? colors.danger : colors.border, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, minWidth: 200 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: cancelArmed ? colors.dangerText : colors.textPrimary }}>
            {cancelArmed ? t('common.cancel') : t('chat.recording', { seconds })}
          </Text>
          {!cancelArmed ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{t('chat.recording_cancel')}</Text>
          ) : null}
        </View>
      ) : null}
      <Pressable
        onPressIn={begin}
        onTouchMove={move}
        onPressOut={() => { void finish(); }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('chat.voice_note')}
        accessibilityHint={t('chat.record_hint')}
        style={{ width: 52, height: 52, borderRadius: radius.lg, backgroundColor: holding ? colors.danger : (disabled ? colors.border : colors.brand), alignItems: 'center', justifyContent: 'center', transform: [{ scale: holding ? 1.12 : 1 }] }}
      >
        <Icon name="mic" size={22} color={disabled && !holding ? colors.textTertiary : '#fff'} />
      </Pressable>
    </View>
  );
}
