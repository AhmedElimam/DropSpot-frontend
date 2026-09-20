import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Switch, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useCreateThread, useUploadThreadVideo } from '@/hooks/useThreads';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { VideoRecorder, type RecordedClip } from './VideoRecorder';
import type { ThreadGrade, ThreadLimits, ThreadSettings } from '@/api/threads';

/** The timer presets a teacher actually reaches for, in minutes; 0 = no timer. */
export const TIMER_PRESETS: { minutes: number; key: string }[] = [
  { minutes: 15, key: 'threads.timer_15m' },
  { minutes: 60, key: 'threads.timer_1h' },
  { minutes: 180, key: 'threads.timer_3h' },
  { minutes: 1440, key: 'threads.timer_1d' },
  { minutes: 2880, key: 'threads.timer_2d' },
  { minutes: 10080, key: 'threads.timer_1w' },
  { minutes: 0, key: 'threads.timer_none' },
];

/**
 * The teacher writes a question (or a note) to one grade. Grade chips carry the live audience
 * size so the teacher sees who will be pushed before tapping publish. A recorded clip is
 * uploaded first, then claimed by the post — a failed upload never leaves a half post.
 */
export function ComposeThreadSheet({ visible, grades, settings, limits, onClose, onCreated }: {
  visible: boolean;
  grades: ThreadGrade[];
  settings: ThreadSettings | undefined;
  limits: ThreadLimits | undefined;
  onClose: () => void;
  onCreated: (threadId: number) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<'question' | 'note'>('question');
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [minutes, setMinutes] = useState<number>(60);
  const [quiz, setQuiz] = useState(false);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const create = useCreateThread();
  const upload = useUploadThreadVideo();

  useEffect(() => {
    if (visible) {
      setKind('question'); setTitle(''); setBody(''); setQuiz(false); setClip(null);
      setGradeId(grades[0]?.id ?? null);
      const def = (settings?.default_close_hours ?? 24) * 60;
      setMinutes(TIMER_PRESETS.some((p) => p.minutes === def) ? def : 1440);
    }
  }, [visible]);

  const maxVideo = limits?.video_max_seconds ?? 120;
  const busy = create.isPending || upload.isPending;
  const canPublish = !!gradeId && !busy && (kind === 'note' ? (title.trim() || body.trim() || clip) : title.trim().length > 0);

  const publish = async () => {
    if (!gradeId) return;
    try {
      let videoId: number | null = null;
      if (clip) {
        const v = await upload.mutateAsync({ uri: clip.uri, name: clip.name, mime: clip.mime, duration: clip.duration });
        videoId = v.id;
      }
      const thread = await create.mutateAsync({
        kind, grade_id: gradeId, title: title.trim() || undefined, body: body.trim() || undefined, video_id: videoId,
        close_minutes: kind === 'question' ? (minutes > 0 ? minutes : null) : undefined,
        reveal_at_close: kind === 'question' ? quiz : false,
      });
      onCreated(thread.id);
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, maxHeight: '92%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'right' }}>{kind === 'question' ? t('threads.compose') : t('threads.compose_note')}</Text>
            <TouchableOpacity onPress={onClose} disabled={busy} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg + insets.bottom, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
            {/* Kind */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['question', 'note'] as const).map((k) => {
                const on = kind === k;
                return (
                  <TouchableOpacity key={k} onPress={() => setKind(k)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
                    <Icon name={k === 'question' ? 'question' : 'lightbulb'} size={17} color={on ? colors.brandDeep : colors.textSecondary} outline={!on} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: on ? colors.brandDeep : colors.textSecondary }}>{t(k === 'question' ? 'threads.kind_question' : 'threads.kind_note')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Grade */}
            <View>
              <Label text={t('threads.grade')} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {grades.map((g) => {
                  const on = gradeId === g.id;
                  return (
                    <TouchableOpacity key={g.id} onPress={() => setGradeId(g.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.brandDeep : colors.textPrimary }}>{g.name}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: on ? colors.brandDeep : colors.textTertiary }}>{t('threads.grade_audience', { students: g.students, courses: g.courses })}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Title / body */}
            <View>
              <Label text={t('threads.title_label')} />
              <TextInput
                value={title} onChangeText={setTitle} placeholder={t('threads.title_placeholder')} placeholderTextColor={colors.textTertiary}
                maxLength={limits?.title_max_chars ?? 200} multiline
                style={{ minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, textAlign: 'right', backgroundColor: colors.surfaceSunken }}
              />
            </View>
            <View>
              <Label text={t('threads.body_label')} />
              <TextInput
                value={body} onChangeText={setBody} placeholder={t('threads.body_placeholder')} placeholderTextColor={colors.textTertiary}
                maxLength={limits?.body_max_chars ?? 4000} multiline
                style={{ minHeight: 84, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top', backgroundColor: colors.surfaceSunken }}
              />
            </View>

            {/* Timer + quiz mode */}
            {kind === 'question' ? (
              <>
                <View>
                  <Label text={t('threads.timer')} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {TIMER_PRESETS.map((p) => {
                      const on = minutes === p.minutes;
                      return (
                        <TouchableOpacity key={p.minutes} onPress={() => setMinutes(p.minutes)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: on ? colors.brandDeep : colors.textSecondary }}>{t(p.key)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
                  <Icon name="eyeOff" size={20} color={colors.textSecondary} outline />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, textAlign: 'right' }}>{t('threads.quiz_mode')}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, textAlign: 'right' }}>{t('threads.quiz_mode_hint')}</Text>
                  </View>
                  <Switch value={quiz} onValueChange={setQuiz} trackColor={{ true: colors.brand, false: colors.border }} />
                </View>
              </>
            ) : null}

            {/* Video */}
            <View>
              <Label text={t('threads.attach_video')} />
              {clip ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.successLight, borderWidth: 1, borderColor: '#BFE3D2' }}>
                  <Icon name="video" size={20} color={colors.successText} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.successText, textAlign: 'right' }}>{t('threads.video_attached', { seconds: clip.duration })}</Text>
                  <TouchableOpacity onPress={() => setClip(null)}><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger }}>{t('threads.remove_video')}</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setRecorderOpen(true)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong }}>
                  <Icon name="video" size={20} color={colors.brand} outline />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.brand }}>{t('threads.record_video')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <Button title={busy ? (upload.isPending ? t('threads.uploading') : t('common.loading')) : t('threads.publish')} onPress={publish} disabled={!canPublish} loading={busy} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <VideoRecorder visible={recorderOpen} maxSeconds={maxVideo} onClose={() => setRecorderOpen(false)} onRecorded={(c) => { setClip(c); setRecorderOpen(false); }} />
    </Modal>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.sm }}>{text}</Text>;
}
