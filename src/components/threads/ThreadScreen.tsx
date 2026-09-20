import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import {
  useCommentOnThread, useExtendThread, useHideThreadComment, useLockThread, usePickThreadComment, useReportThreadComment, useThread, useVoteThreadComment, useWithdrawThread,
} from '@/hooks/useThreads';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { timeAgo } from '@/utils/format';
import type { Thread, ThreadComment, ThreadVideo } from '@/api/threads';
import { StateChip, stateOf } from './ThreadCard';
import { ThreadVideoPlayer } from './ThreadVideoPlayer';
import { AnswerSheet, AudienceSheet, ExtendSheet, ReportSheet, TextSheet } from './ThreadSheets';

/**
 * One thread, one screen — student and teacher alike. Everything role-specific hangs off the
 * server's `permissions`: a student gets the composer and the vote arrows, a teacher gets
 * lock / extend / answer / pick / hide, an assistant gets hide and the report queue. Two
 * copies would be two places for the rules to drift.
 */
export function ThreadScreen({ threadId }: { threadId: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { data, isLoading, isError, refetch } = useThread(threadId, focused);
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [player, setPlayer] = useState<ThreadVideo | null>(null);
  const [reportFor, setReportFor] = useState<ThreadComment | null>(null);
  const [hideFor, setHideFor] = useState<ThreadComment | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [audienceFor, setAudienceFor] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const comment = useCommentOnThread(threadId);
  const vote = useVoteThreadComment(threadId);
  const pick = usePickThreadComment(threadId);
  const hide = useHideThreadComment(threadId);
  const report = useReportThreadComment();
  const lock = useLockThread(threadId);
  const extend = useExtendThread(threadId);
  const withdraw = useWithdrawThread();

  const fail = (e: unknown) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
  const thread = data?.thread;
  const perms = thread?.permissions;
  const isModerator = !!perms?.can_moderate;
  const isTeacher = perms?.role === 'teacher';

  const onCommentMenu = (c: ThreadComment) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (c.author.is_me && !c.hidden) {
      buttons.push({ text: t('threads.delete_mine'), style: 'destructive', onPress: () => Alert.alert(t('threads.delete_mine'), t('threads.delete_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), style: 'destructive', onPress: () => hide.mutate({ commentId: c.id }, { onError: fail }) },
      ]) });
    }
    if (isTeacher && !c.hidden) {
      buttons.push({ text: c.picked ? t('threads.unpick') : t('threads.pick'), onPress: () => pick.mutate({ commentId: c.id, picked: !c.picked }, { onError: fail }) });
    }
    if (isModerator && !c.hidden) {
      buttons.push({ text: t('threads.hide'), style: 'destructive', onPress: () => setHideFor(c) });
    }
    if (!isModerator && !c.author.is_me) {
      buttons.push({ text: t('threads.report'), style: 'destructive', onPress: () => setReportFor(c) });
    }
    if (buttons.length === 0) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('threads.comment_actions'), undefined, buttons);
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    comment.mutate(body, { onSuccess: () => setDraft(''), onError: fail });
  };

  const state = thread ? stateOf(thread) : 'open';
  const bottomPad = insets.bottom + spacing.md;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t('common.back')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="forward" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff', textAlign: 'right' }} numberOfLines={1}>{t('threads.title')}</Text>
            {thread ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.72)', textAlign: 'right' }} numberOfLines={1}>
                {thread.grade.name ?? ''} · {t('threads.by_teacher', { name: thread.teacher.name })}
              </Text>
            ) : null}
          </View>
          {thread && isTeacher ? (
            <TouchableOpacity
              onPress={() => Alert.alert(t('threads.withdraw'), t('threads.withdraw_confirm'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('threads.withdraw'), style: 'destructive', onPress: () => withdraw.mutate(thread.id, { onSuccess: () => router.back(), onError: fail }) },
              ])}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="trash" size={20} color="rgba(255,255,255,0.85)" outline />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
        ) : isError || !thread || !data ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {/* The question */}
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md, ...shadows.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <StateChip thread={thread} state={state} large />
                {thread.reveal_at_close ? <Tag icon="eyeOff" text={t('threads.quiz_badge')} /> : null}
                {thread.audience_count !== null ? <Tag icon="people" text={t('threads.audience_count', { count: thread.audience_count })} /> : null}
              </View>
              {thread.title ? <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: colors.textPrimary, textAlign: 'right' }}>{thread.title}</Text> : null}
              {thread.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 25, color: colors.textSecondary, textAlign: 'right' }}>{thread.body}</Text> : null}
              {thread.video ? <VideoTile video={thread.video} onPlay={() => setPlayer(thread.video)} onAudience={isModerator ? () => setAudienceFor(thread.video!.id) : undefined} /> : null}
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, textAlign: 'right' }}>{timeAgo(thread.created_at)}</Text>

              {/* Moderator controls */}
              {isModerator && thread.kind === 'question' ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  {perms?.can_lock ? <Action icon="lock" label={t('threads.lock_now')} onPress={() => Alert.alert(t('threads.lock_now'), t('threads.lock_confirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('threads.lock_now'), onPress: () => lock.mutate(undefined, { onError: fail }) }])} /> : null}
                  {perms?.can_extend && !thread.open ? <Action icon="refresh" label={t('threads.extend')} onPress={() => setExtendOpen(true)} /> : null}
                  {perms?.can_answer ? <Action icon="mic" label={t('threads.answer_title')} primary onPress={() => setAnswerOpen(true)} /> : null}
                </View>
              ) : null}
            </View>

            {/* The teacher's answer */}
            {thread.kind === 'question' ? (
              thread.answer ? (
                <View style={{ backgroundColor: colors.successLight, borderRadius: radius.xl, borderWidth: 1, borderColor: '#BFE3D2', padding: spacing.lg, gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="teacher" size={18} color={colors.successText} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.successText }}>{t('threads.teacher_answer')}</Text>
                  </View>
                  {thread.answer.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 26, color: colors.textPrimary, textAlign: 'right' }}>{thread.answer.body}</Text> : null}
                  {thread.answer.video ? <VideoTile video={thread.answer.video} onPlay={() => setPlayer(thread.answer!.video)} onAudience={isModerator ? () => setAudienceFor(thread.answer!.video!.id) : undefined} /> : null}
                </View>
              ) : !thread.open && !isModerator ? (
                <Banner icon="clock" text={thread.closed_reason === 'locked' ? t('threads.closed_banner_locked') : t('threads.closed_banner_timer')} />
              ) : null
            ) : null}

            {thread.answers_hidden ? <Banner icon="eyeOff" title={t('threads.answers_hidden_title')} text={t('threads.answers_hidden_body')} /> : null}

            {/* Students' answers */}
            {thread.kind === 'question' ? (
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('threads.student_answers')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{t('threads.answers_count', { count: thread.comments_count })}</Text>
                  <View style={{ flex: 1 }} />
                  {!thread.answers_hidden ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{t('threads.ranking_hint')}</Text> : null}
                </View>
                {data.comments.length === 0 ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }}>{isModerator ? t('threads.no_answers_teacher') : t('threads.no_answers')}</Text>
                ) : data.comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    canVote={!!perms?.can_vote && !c.author.is_me && !c.hidden}
                    downvotes={thread.downvotes_enabled}
                    onVote={(v) => vote.mutate({ commentId: c.id, value: v }, { onError: fail })}
                    onLongPress={() => onCommentMenu(c)}
                  />
                ))}
              </View>
            ) : null}
          </ScrollView>
        )}

        {/* Composer */}
        {thread && perms?.can_comment ? (
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: bottomPad }}>
            {thread.my_comment_id ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, textAlign: 'right', marginBottom: 4 }}>{t('threads.edit_answer')}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
              <TextInput
                value={draft} onChangeText={setDraft} placeholder={t('threads.write_answer')} placeholderTextColor={colors.textTertiary}
                multiline maxLength={data?.limits.comment_max_chars ?? 1000}
                style={{ flex: 1, minHeight: 46, maxHeight: 130, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 15.5, color: colors.textPrimary, textAlign: 'right', backgroundColor: colors.surfaceSunken }}
              />
              <TouchableOpacity onPress={send} disabled={!draft.trim() || comment.isPending} accessibilityLabel={t('threads.send')} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: draft.trim() ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                {comment.isPending ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={20} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ThreadVideoPlayer video={player} onClose={() => setPlayer(null)} />
      <ReportSheet
        visible={!!reportFor} reasons={data?.report_reasons ?? {}} pending={report.isPending} onClose={() => setReportFor(null)}
        onSubmit={(reason, note) => reportFor && report.mutate({ commentId: reportFor.id, reason, note }, {
          onSuccess: (msg) => { setReportFor(null); Alert.alert(t('threads.report'), msg); },
          onError: fail,
        })}
      />
      <TextSheet
        visible={!!hideFor} title={t('threads.hide')} placeholder={t('threads.hide_reason')} confirm={t('threads.hide_confirm')} pending={hide.isPending}
        onClose={() => setHideFor(null)}
        onSubmit={(reason) => hideFor && hide.mutate({ commentId: hideFor.id, reason: reason || undefined }, { onSuccess: () => setHideFor(null), onError: fail })}
      />
      {thread ? <AnswerSheet visible={answerOpen} threadId={thread.id} maxSeconds={data?.limits.video_max_seconds ?? 120} onClose={() => setAnswerOpen(false)} onDone={() => setAnswerOpen(false)} /> : null}
      <ExtendSheet visible={extendOpen} pending={extend.isPending} onClose={() => setExtendOpen(false)} onSubmit={(m) => extend.mutate(m, { onSuccess: () => setExtendOpen(false), onError: fail })} />
      <AudienceSheet videoId={audienceFor} onClose={() => setAudienceFor(null)} />
    </View>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function CommentRow({ comment: c, canVote, downvotes, onVote, onLongPress }: {
  comment: ThreadComment; canVote: boolean; downvotes: boolean; onVote: (v: -1 | 0 | 1) => void; onLongPress: () => void;
}) {
  const { t } = useTranslation();
  const scoreColor = c.score > 0 ? colors.success : c.score < 0 ? colors.danger : colors.textTertiary;
  return (
    <TouchableOpacity onLongPress={onLongPress} delayLongPress={350} activeOpacity={0.85} style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: c.picked ? colors.accentWarmTint : colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.picked ? '#F0DDB8' : colors.border, padding: spacing.md, opacity: c.hidden ? 0.75 : 1 }}>
      {/* Vote column */}
      <View style={{ alignItems: 'center', width: 40 }}>
        <TouchableOpacity onPress={() => onVote(c.my_vote === 1 ? 0 : 1)} disabled={!canVote} accessibilityLabel={t('threads.vote_up')} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.my_vote === 1 ? colors.successLight : 'transparent' }}>
          <Icon name="thumbUp" size={18} color={c.my_vote === 1 ? colors.success : canVote ? colors.textSecondary : colors.border} outline={c.my_vote !== 1} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: scoreColor, fontVariant: ['tabular-nums'] }}>{c.score > 0 ? `+${c.score}` : c.score}</Text>
        {downvotes ? (
          <TouchableOpacity onPress={() => onVote(c.my_vote === -1 ? 0 : -1)} disabled={!canVote} accessibilityLabel={t('threads.vote_down')} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.my_vote === -1 ? colors.dangerLight : 'transparent' }}>
            <Icon name="thumbDown" size={18} color={c.my_vote === -1 ? colors.danger : canVote ? colors.textSecondary : colors.border} outline={c.my_vote !== -1} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.author.is_me ? colors.brandDeep : colors.textPrimary }}>{c.author.is_me ? t('threads.you') : c.author.name}</Text>
          {c.picked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.accentWarm }}>
              <Icon name="star" size={11} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{t('threads.picked')}</Text>
            </View>
          ) : null}
          {c.hidden ? <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.dangerText }}>{t('threads.hidden')}{c.hidden_reason ? `: ${c.hidden_reason}` : ''}</Text> : null}
          <View style={{ flex: 1 }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{timeAgo(c.created_at)}{c.edited ? ` · ${t('threads.edited')}` : ''}</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 24, color: c.hidden ? colors.textTertiary : colors.textPrimary, textAlign: 'right', marginTop: 4, textDecorationLine: c.hidden ? 'line-through' : 'none' }}>
          {c.body ?? t('threads.hidden_by_teacher')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** The video as a tall tile — a play button on a dark card; the poster when there is one. */
function VideoTile({ video, onPlay, onAudience }: { video: ThreadVideo; onPlay: () => void; onAudience?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: spacing.sm }}>
      <TouchableOpacity onPress={onPlay} disabled={video.expired} activeOpacity={0.85} style={{ height: 190, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={['#2A356F', '#141931']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={video.expired ? 'clock' : 'play'} size={30} color="#fff" style={{ marginStart: video.expired ? 0 : 4 }} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff', marginTop: spacing.sm }}>{video.expired ? t('threads.video_expired') : t('threads.video_watch')}</Text>
        <View style={{ position: 'absolute', bottom: spacing.sm, start: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Icon name="clock" size={12} color="#fff" outline />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff' }}>{t('threads.video_seconds', { seconds: video.duration })}</Text>
        </View>
        <View style={{ position: 'absolute', bottom: spacing.sm, end: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="shield" size={13} color="rgba(255,255,255,0.8)" />
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>DrosSpot</Text>
        </View>
      </TouchableOpacity>
      {onAudience ? (
        <TouchableOpacity onPress={onAudience} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
          <Icon name="eye" size={16} color={colors.textSecondary} outline />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary }}>{t('threads.who_watched')}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, textAlign: 'right' }}>{t('threads.video_protected')}</Text>
      )}
    </View>
  );
}

function Tag({ icon, text }: { icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
      <Icon name={icon} size={13} color={colors.textSecondary} outline />
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{text}</Text>
    </View>
  );
}

function Action({ icon, label, onPress, primary }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: primary ? colors.brand : colors.surface, borderWidth: 1, borderColor: primary ? colors.brand : colors.border }}>
      <Icon name={icon} size={16} color={primary ? '#fff' : colors.textSecondary} outline={!primary} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: primary ? '#fff' : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Banner({ icon, title, text }: { icon: Parameters<typeof Icon>[0]['name']; title?: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: '#EAD9A6' }}>
      <Icon name={icon} size={18} color={colors.warningText} outline style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningText, textAlign: 'right' }}>{title}</Text> : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.warningText, textAlign: 'right' }}>{text}</Text>
      </View>
    </View>
  );
}

export type { Thread };
