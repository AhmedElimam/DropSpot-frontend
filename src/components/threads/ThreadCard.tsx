import { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { Thread, ThreadVideo } from '@/api/threads';
import { useMediaHeaders } from './mediaHeaders';
import { InitialsAvatar } from './Avatar';
import { Countdown, TimerBar } from './Countdown';
import { ago, arDigits, stateOf, type ThreadState } from './format';
import { childLabel } from './parents';

export { stateOf, type ThreadState } from './format';

/**
 * One حكاية in the feed, drawn as a social post: who posted it and to which grade, the
 * question big, and a STATE STRIP that tells the story at a glance — a draining clock while
 * the round is open, amber while the teacher's answer is awaited, green with the answer's
 * first lines (and its video's poster) once it landed. A تكة (a note) is a warm tip card.
 *
 * memo + a stable `onOpen`: a poll that returns the same rows re-renders nothing, and the
 * clock inside re-renders only itself (Countdown.tsx).
 */
export const ThreadCard = memo(function ThreadCard({ thread: t, onOpen, staff, index = 0 }: {
  thread: Thread;
  onOpen: (id: number) => void;
  /** The reader moderates (teacher / assistant): their wording, the audience size. */
  staff: boolean;
  /** Position in the list — staggers the entrance (capped). */
  index?: number;
}) {
  const { t: tr } = useTranslation();
  const state = stateOf(t);
  const note = state === 'note';
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const open = useCallback(() => onOpen(t.id), [onOpen, t.id]);
  const video = t.video;
  // A parent's card says whose class it reached: «لأحمد ومنى».
  const forChildren = childLabel(t.children);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 45).duration(280)}>
      <Pressable
        onPress={open}
        onPressIn={() => { scale.value = withTiming(0.975, { duration: 90 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 260 }); }}
        accessibilityRole="button"
        accessibilityLabel={t.title ?? t.body ?? undefined}
      >
        <Animated.View
          style={[{
            backgroundColor: note ? colors.accentWarmTint : colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            // Unread is the avatar's ring and the dot — never a heavy border.
            borderColor: note ? colors.accentLight : colors.borderLight,
            padding: spacing.lg,
            gap: spacing.md,
            ...shadows.sm,
          }, pressStyle]}
        >
          {forChildren ? <ChildTag label={forChildren} /> : null}

          {/* Who, where, when */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <InitialsAvatar id={t.teacher.id} name={t.teacher.name} size={42} ring={t.unread ? colors.brand : null} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{t.teacher.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 1, borderRadius: radius.full, backgroundColor: note ? colors.surface : colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
                  <Icon name="teacher" size={11} color={colors.textTertiary} outline />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary }} numberOfLines={1}>{t.grade.name ?? '—'}</Text>
                </View>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{ago(t.created_at)}</Text>
              </View>
            </View>
            {t.unread ? <UnreadDot /> : null}
            <KindTag note={note} />
          </View>

          {/* The words, and the video's poster beside them */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 17.5, lineHeight: 28, color: colors.textPrimary }} numberOfLines={4}>
                {t.title ?? t.body ?? tr('threads.video_badge')}
              </Text>
              {t.title && t.body ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }} numberOfLines={2}>{t.body}</Text>
              ) : null}
            </View>
            {video ? <PosterThumb video={video} width={64} /> : null}
          </View>

          {note ? null : <StateStrip thread={t} state={state} staff={staff} />}

          {/* Footer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {!note ? <Pill icon="chat" text={tr('threads.answers_count', { n: arDigits(t.comments_count) })} /> : null}
            {staff && t.audience_count !== null ? <Pill icon="people" text={tr('threads.audience_count', { n: arDigits(t.audience_count) })} /> : null}
            {!staff && !note ? <MyAnswer thread={t} /> : null}
            <View style={{ flex: 1 }} />
            {/* RTL: a row's disclosure points left. */}
            <Icon name="back" size={16} color={colors.textTertiary} />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

/** The strip under the question: the round's state, in colour. */
function StateStrip({ thread: t, state, staff }: { thread: Thread; state: ThreadState; staff: boolean }) {
  const { t: tr } = useTranslation();

  if (state === 'open') {
    return (
      <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="timer" size={16} color={colors.brand} outline />
          {t.comments_close_at ? (
            <Countdown endsAt={t.comments_close_at} prefix={tr('threads.open_until')} style={{ fontSize: 13.5, color: colors.textPrimary }} />
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{tr('threads.open_no_timer')}</Text>
          )}
        </View>
        {t.comments_close_at ? <TimerBar createdAt={t.created_at} endsAt={t.comments_close_at} color={colors.brand} track={colors.surface} /> : null}
        {t.reveal_at_close ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="lock" size={13} color={colors.textSecondary} outline />
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{tr('threads.quiz_hidden_badge')}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (state === 'answered') {
    const a = t.answer;
    return (
      <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.successLight }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="success" size={16} color={colors.success} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.successText }}>{tr('threads.teacher_answer')}</Text>
          </View>
          {a?.body ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textPrimary }} numberOfLines={3}>{a.body}</Text>
          ) : a?.video ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.successText }}>{tr('threads.answer_video_line')}</Text>
          ) : null}
        </View>
        {a?.video ? <PosterThumb video={a.video} width={52} /> : null}
      </View>
    );
  }

  // The round is over; the answer is awaited.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight }}>
      <Icon name="hourglass" size={17} color={colors.warning} outline />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.warningText }}>{staff ? tr('threads.awaiting_answer_teacher') : tr('threads.awaiting_answer')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.warningText, opacity: 0.85 }}>{state === 'locked' ? tr('threads.closed_locked') : tr('threads.closed_timer')}</Text>
      </View>
    </View>
  );
}

/** The student's own part: «جاوبت» once written, a «جاوب» nudge while the round is open. */
function MyAnswer({ thread: t }: { thread: Thread }) {
  const { t: tr } = useTranslation();
  if (t.my_comment_id) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radius.full, backgroundColor: colors.successLight }}>
        <Icon name="check" size={13} color={colors.success} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.successText }}>{tr('threads.answered_cta')}</Text>
      </View>
    );
  }
  if (t.open && t.permissions.can_comment) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 28, borderRadius: radius.full, backgroundColor: colors.brand }}>
        <Icon name="note" size={13} color="#FFFFFF" outline />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>{tr('threads.answer_cta')}</Text>
      </View>
    );
  }
  return null;
}

/** A parent's card: which of their children this post reached. */
function ChildTag({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, height: 26, borderRadius: radius.full, backgroundColor: colors.brandTint, marginBottom: -spacing.xs }}>
      <Icon name="child" size={13} color={colors.brand} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function KindTag({ note }: { note: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 26, borderRadius: radius.full, backgroundColor: note ? colors.accentWarm : colors.brandTint }}>
      <Icon name={note ? 'lightbulb' : 'question'} size={13} color={note ? colors.onAccent : colors.brand} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: note ? colors.onAccent : colors.brand }}>{note ? t('threads.note_badge') : t('threads.kind_question')}</Text>
    </View>
  );
}

/** «جديد» without a word: a dot with a soft halo. Static — nothing loops. */
function UnreadDot() {
  return (
    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand }} />
    </View>
  );
}

function Pill({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
      <Icon name={icon} size={13} color={colors.textSecondary} outline />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{text}</Text>
    </View>
  );
}

/**
 * A vertical video's poster, small: the poster when the server has one, else the ink tile,
 * with a play glyph — TikTok-shaped so it reads as "a short video" before any words.
 */
export const PosterThumb = memo(function PosterThumb({ video, width }: { video: ThreadVideo; width: number }) {
  const height = Math.round(width * 1.5);
  // The poster is an authenticated API route: bearer (+ the staging door key), shared by every card.
  const headers = useMediaHeaders();
  return (
    <View style={{ width, height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#1E2657', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={['#2A356F', '#141931']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {video.poster_url && !video.expired && headers ? (
        <Image source={{ uri: video.poster_url, headers }} transition={150} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
      ) : null}
      <View style={{ width: width * 0.48, height: width * 0.48, borderRadius: width * 0.24, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={video.expired ? 'clock' : 'play'} size={width * 0.24} color="#FFFFFF" style={{ marginStart: video.expired ? 0 : 2 }} />
      </View>
      <View style={{ position: 'absolute', bottom: 4, start: 4, paddingHorizontal: 5, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#FFFFFF' }}>{arDigits(video.duration)}ث</Text>
      </View>
    </View>
  );
});
