import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useCreateThread, useUploadThreadVideo } from '@/hooks/useThreads';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { VideoRecorder, type RecordedClip } from './VideoRecorder';
import { Choice, Sheet, VideoAttach, threadInputStyle } from './ThreadSheets';
import { TIMER_PRESETS, arDigits } from './format';
import type { ThreadGrade, ThreadLimits, ThreadSettings } from '@/api/threads';

export { TIMER_PRESETS } from './format';

/**
 * The teacher writes a حكاية — a question (with a clock, maybe in quiz mode) or a تكة (a tip,
 * no round) — to one grade. Grade chips carry the live audience size so the teacher sees who
 * will be pushed before tapping publish. A recorded clip is uploaded first, then claimed by
 * the post — a failed upload never leaves a half post.
 */
export function ComposeThreadSheet({ visible, grades, settings, limits, initialKind = 'question', onClose, onCreated }: {
  visible: boolean;
  grades: ThreadGrade[];
  settings: ThreadSettings | undefined;
  limits: ThreadLimits | undefined;
  initialKind?: 'question' | 'note';
  onClose: () => void;
  onCreated: (threadId: number) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'question' | 'note'>(initialKind);
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
      setKind(initialKind); setTitle(''); setBody(''); setQuiz(false); setClip(null);
      setGradeId(grades[0]?.id ?? null);
      const def = (settings?.default_close_hours ?? 24) * 60;
      setMinutes(TIMER_PRESETS.some((p) => p.minutes === def) ? def : 1440);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxVideo = limits?.video_max_seconds ?? 120;
  const titleMax = limits?.title_max_chars ?? 200;
  const bodyMax = limits?.body_max_chars ?? 4000;
  const busy = create.isPending || upload.isPending;
  const question = kind === 'question';
  const canPublish = !!gradeId && !busy && (question ? title.trim().length > 0 : !!(title.trim() || body.trim() || clip));

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
        close_minutes: question ? (minutes > 0 ? minutes : null) : undefined,
        reveal_at_close: question ? quiz : false,
      });
      onCreated(thread.id);
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    }
  };

  return (
    <Sheet
      visible={visible}
      title={question ? t('threads.compose') : t('threads.compose_note')}
      subtitle={question ? t('threads.compose_sub') : t('threads.compose_note_sub')}
      icon={question ? 'question' : 'lightbulb'}
      tone={question ? 'brand' : 'warm'}
      onClose={onClose}
      busy={busy}
    >
      {/* Kind */}
      <View style={{ flexDirection: 'row', padding: 4, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
        {(['question', 'note'] as const).map((k) => {
          const on = kind === k;
          const ink = k === 'question' ? colors.brand : colors.accentText;
          return (
            <TouchableOpacity key={k} onPress={() => setKind(k)} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, backgroundColor: on ? colors.surface : 'transparent', ...(on ? shadows.sm : null) }}>
              <Icon name={k === 'question' ? 'question' : 'lightbulb'} size={17} color={on ? ink : colors.textTertiary} outline={!on} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? ink : colors.textTertiary }}>{t(k === 'question' ? 'threads.kind_question' : 'threads.kind_note')}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Grade */}
      <Section label={t('threads.grade')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {grades.map((g) => (
            <Choice key={g.id} label={g.name} sub={t('threads.grade_audience', { students: arDigits(g.students), courses: arDigits(g.courses) })} active={gradeId === g.id} onPress={() => setGradeId(g.id)} />
          ))}
        </View>
      </Section>

      {/* Title / body */}
      <Section label={question ? t('threads.title_label') : t('threads.title_label_note')} counter={{ used: title.length, max: titleMax }}>
        <TextInput
          value={title} onChangeText={setTitle} placeholder={question ? t('threads.title_placeholder') : t('threads.title_placeholder_note')} placeholderTextColor={colors.textTertiary}
          maxLength={titleMax} multiline
          style={[threadInputStyle(), { fontFamily: fonts.medium, fontSize: 16 }]}
        />
      </Section>
      <Section label={t('threads.body_label')} counter={{ used: body.length, max: bodyMax }}>
        <TextInput
          value={body} onChangeText={setBody} placeholder={t('threads.body_placeholder')} placeholderTextColor={colors.textTertiary}
          maxLength={bodyMax} multiline
          style={[threadInputStyle(), { minHeight: 84, textAlignVertical: 'top' }]}
        />
      </Section>

      {/* Timer + quiz mode */}
      {question ? (
        <>
          <Section label={t('threads.timer')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {TIMER_PRESETS.map((p) => (
                <Choice key={p.minutes} label={t(p.key)} active={minutes === p.minutes} onPress={() => setMinutes(p.minutes)} />
              ))}
            </View>
          </Section>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: quiz ? colors.brandTint : colors.surface, borderWidth: 1, borderColor: quiz ? colors.brand : colors.borderLight }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: quiz ? colors.brand : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lock" size={18} color={quiz ? colors.onPrimary : colors.textTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('threads.quiz_mode')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{t('threads.quiz_mode_hint')}</Text>
            </View>
            <Switch value={quiz} onValueChange={setQuiz} trackColor={{ true: colors.brand, false: colors.border }} />
          </View>
        </>
      ) : null}

      {/* Video */}
      <VideoAttach
        clip={clip}
        onRecord={() => setRecorderOpen(true)}
        onRemove={() => setClip(null)}
        label={t('threads.record_video')}
        hint={t('threads.record_video_hint', { seconds: arDigits(maxVideo) })}
      />

      <Button title={busy ? (upload.isPending ? t('threads.uploading') : t('common.loading')) : t('threads.publish')} onPress={publish} disabled={!canPublish} loading={busy} />

      {/* Inside the sheet's window, so iOS presents it over the sheet instead of queueing it. */}
      <VideoRecorder visible={recorderOpen} maxSeconds={maxVideo} onClose={() => setRecorderOpen(false)} onRecorded={(c) => { setClip(c); setRecorderOpen(false); }} />
    </Sheet>
  );
}

/** A labelled block; an optional chars-left counter on the far side, red near the cap. */
function Section({ label, counter, children }: { label: string; counter?: { used: number; max: number }; children: React.ReactNode }) {
  const left = counter ? counter.max - counter.used : 0;
  const near = counter ? left <= Math.max(10, Math.round(counter.max * 0.1)) : false;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.textSecondary }}>{label}</Text>
        {counter && counter.used > 0 ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: near ? colors.danger : colors.textTertiary, fontVariant: ['tabular-nums'] }}>{arDigits(left)}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
