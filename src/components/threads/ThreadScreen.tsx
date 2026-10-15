import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, RefreshControl } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useKeyboardShown } from '@/hooks/useKeyboardShown';
import {
  useCommentOnThread, useExtendThread, useHideThreadComment, useLockThread, usePickThreadComment, useReportThreadComment, useThread, useThreadsRealtime, useVoteThreadComment, useWithdrawThread,
} from '@/hooks/useThreads';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { haptic } from '@/utils/haptics';
import type { Thread, ThreadComment, ThreadPermissions, ThreadVideo } from '@/api/threads';
import { PosterThumb } from './ThreadCard';
import { InitialsAvatar } from './Avatar';
import { CountdownRing } from './Countdown';
import { ago, arDigits, stateOf, type ThreadState } from './format';
import { ThreadVideoPlayer } from './ThreadVideoPlayer';
import { AnswerSheet, AudienceSheet, ExtendSheet, ReportSheet, Sheet, TextSheet } from './ThreadSheets';

type MenuItem = { key: string; icon: IconName; label: string; danger?: boolean; onPress: () => void };

/**
 * One حكاية, one screen — student and teacher alike. Everything role-specific hangs off the
 * server's `permissions`: a student gets the composer and the vote pill, a teacher gets
 * answer / lock / extend / pick / hide, an assistant gets hide and the report queue. Two
 * copies would be two places for the rules to drift.
 *
 * The shape: an ink hero carrying the question, who asked it and the round's clock (a ring
 * that empties, or a seal once it is over); the teacher's answer pinned right under it; then
 * the students' answers as social comments, ranked by the server; and, for a student, a
 * composer pinned to the bottom like the chat's.
 */
export function ThreadScreen({ threadId }: { threadId: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const keyboardUp = useKeyboardShown();
  // Live: a comment, a vote, the teacher's answer or lock lands the moment it happens; the
  // poll then only backstops (see useThread).
  const [live, setLive] = useState(false);
  const { data, isLoading, isError, refetch } = useThread(threadId, focused, live);
  const channels = useMemo(() => (data?.channel ? [data.channel] : []), [data?.channel]);
  const { connected } = useThreadsRealtime(data?.realtime, channels, focused);
  useEffect(() => { setLive(connected); }, [connected]);
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  const [player, setPlayer] = useState<ThreadVideo | null>(null);
  const [reportFor, setReportFor] = useState<ThreadComment | null>(null);
  const [hideFor, setHideFor] = useState<ThreadComment | null>(null);
  const [menu, setMenu] = useState<{ title: string; items: MenuItem[] } | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [audienceFor, setAudienceFor] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const input = useRef<TextInput>(null);

  const comment = useCommentOnThread(threadId);
  const vote = useVoteThreadComment(threadId);
  const pick = usePickThreadComment(threadId);
  const hide = useHideThreadComment(threadId);
  const report = useReportThreadComment();
  const lock = useLockThread(threadId);
  const extend = useExtendThread(threadId);
  const withdraw = useWithdrawThread();

  const thread = data?.thread;
  const perms = thread?.permissions;
  const isModerator = !!perms?.can_moderate;
  const isTeacher = perms?.role === 'teacher';
  const mine = useMemo(() => data?.comments.find((c) => c.author.is_me && !c.hidden) ?? null, [data?.comments]);

  const fail = useCallback((e: unknown) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)), [t]);

  // Stable handlers for the memoised comment rows: they read the latest state through a ref.
  const latest = useRef({ vote, pick, hide, perms, isModerator, isTeacher, mine, fail, t });
  latest.current = { vote, pick, hide, perms, isModerator, isTeacher, mine, fail, t };

  const onVote = useCallback((c: ThreadComment, value: -1 | 0 | 1) => {
    haptic(value === 0 ? 'tick' : 'light');
    latest.current.vote.mutate({ commentId: c.id, value }, { onError: latest.current.fail });
  }, []);

  const editMine = useCallback(() => {
    const m = latest.current.mine;
    if (m?.body) setDraft(m.body);
    setTimeout(() => input.current?.focus(), 50);
  }, []);

  const onCommentMenu = useCallback((c: ThreadComment) => {
    const { perms: p, isModerator: mod, isTeacher: teacher, hide: hideIt, pick: pickIt, t: tr } = latest.current;
    const items: MenuItem[] = [];
    if (c.author.is_me && !c.hidden && p?.can_comment) items.push({ key: 'edit', icon: 'pencil', label: tr('threads.edit_mine'), onPress: editMine });
    if (c.author.is_me && !c.hidden) {
      items.push({ key: 'delete', icon: 'trash', label: tr('threads.delete_mine'), danger: true, onPress: () => Alert.alert(tr('threads.delete_mine'), tr('threads.delete_confirm'), [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.confirm'), style: 'destructive', onPress: () => hideIt.mutate({ commentId: c.id }, { onError: latest.current.fail }) },
      ]) });
    }
    if (teacher && !c.hidden) {
      items.push({ key: 'pick', icon: 'star', label: c.picked ? tr('threads.unpick') : tr('threads.pick'), onPress: () => {
        haptic('success');
        pickIt.mutate({ commentId: c.id, picked: !c.picked }, { onError: latest.current.fail });
      } });
    }
    if (mod && !c.hidden) items.push({ key: 'hide', icon: 'eyeOff', label: tr('threads.hide'), danger: true, onPress: () => setHideFor(c) });
    if (!mod && !c.author.is_me) items.push({ key: 'report', icon: 'flag', label: tr('threads.report'), danger: true, onPress: () => setReportFor(c) });
    if (items.length === 0) return;
    haptic('tick');
    setMenu({ title: c.author.is_me ? tr('threads.your_answer') : tr('threads.comment_actions_of', { name: c.author.name }), items });
  }, [editMine]);

  const postMenu = useMemo<MenuItem[]>(() => {
    if (!thread) return [];
    const items: MenuItem[] = [];
    if (isModerator && thread.video) items.push({ key: 'aq', icon: 'eye', label: t('threads.who_watched_question'), onPress: () => setAudienceFor(thread.video!.id) });
    if (isModerator && thread.answer?.video) items.push({ key: 'aa', icon: 'eye', label: t('threads.who_watched_answer'), onPress: () => setAudienceFor(thread.answer!.video!.id) });
    if (isTeacher) {
      items.push({ key: 'withdraw', icon: 'trash', label: t('threads.withdraw'), danger: true, onPress: () => Alert.alert(t('threads.withdraw'), t('threads.withdraw_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('threads.withdraw'), style: 'destructive', onPress: () => withdraw.mutate(thread.id, { onSuccess: () => router.back(), onError: fail }) },
      ]) });
    }
    return items;
  }, [thread, isModerator, isTeacher, t, withdraw, fail]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    comment.mutate(body, {
      onSuccess: () => { setDraft(''); haptic('success'); input.current?.blur(); },
      onError: fail,
    });
  };

  const state: ThreadState = thread ? stateOf(thread) : 'open';
  const question = thread?.kind === 'question';
  const maxChars = data?.limits.comment_max_chars ?? 1000;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Android edge-to-edge no longer resizes the window for the keyboard: pad on both (as the chat room does). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {isLoading ? (
          <>
            <TopBar />
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
          </>
        ) : isError || !thread || !data ? (
          <>
            <TopBar />
            <ErrorState onRetry={() => refetch()} />
          </>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl + (perms?.can_comment ? 0 : insets.bottom) }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            <Hero
              thread={thread}
              state={state}
              perms={perms}
              isModerator={isModerator}
              onMore={postMenu.length ? () => setMenu({ title: t('threads.post_actions'), items: postMenu }) : undefined}
              onPlay={setPlayer}
              onElapsed={refetch}
              onAnswer={() => setAnswerOpen(true)}
              onLock={() => Alert.alert(t('threads.lock_now'), t('threads.lock_confirm'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('threads.lock_short'), onPress: () => lock.mutate(undefined, { onSuccess: () => haptic('success'), onError: fail }) },
              ])}
              onExtend={() => setExtendOpen(true)}
            />

            <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl, gap: spacing.md }}>
              {question && thread.answer ? <AnswerCard thread={thread} onPlay={setPlayer} /> : null}

              {question && !thread.answer && !thread.open && !isModerator ? (
                <Notice icon="hourglass" tone="warning" text={thread.closed_reason === 'locked' ? t('threads.closed_banner_locked') : t('threads.closed_banner_timer')} />
              ) : null}

              {thread.answers_hidden ? <QuizLocked /> : null}

              {question ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 4, marginTop: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('threads.student_answers')}</Text>
                    <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{arDigits(thread.comments_count)}</Text>
                    </View>
                    <View style={{ flex: 1 }} />
                  </View>
                  {!thread.answers_hidden && data.comments.length > 1 ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, paddingHorizontal: 4, marginTop: -spacing.sm }}>{t('threads.ranking_hint')}</Text>
                  ) : null}

                  {data.comments.length === 0 ? (
                    <NoAnswers staff={isModerator} />
                  ) : data.comments.map((c, i) => (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      index={i}
                      canVote={!!perms?.can_vote && !c.author.is_me && !c.hidden}
                      downvotes={thread.downvotes_enabled}
                      canEdit={c.author.is_me && !c.hidden && !!perms?.can_comment}
                      onVote={onVote}
                      onMenu={onCommentMenu}
                      onEdit={editMine}
                    />
                  ))}
                </>
              ) : null}
            </View>
          </ScrollView>
        )}

        {/* The student's composer, pinned like the chat's. */}
        {thread && perms?.can_comment ? (
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: keyboardUp ? spacing.sm : insets.bottom + spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 6 }}>
              <Icon name={mine ? 'pencil' : 'info'} size={13} color={mine ? colors.brand : colors.textTertiary} outline />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: mine ? colors.brand : colors.textTertiary }} numberOfLines={1}>
                {mine ? t('threads.edit_answer_hint') : t('threads.answer_rule')}
              </Text>
              {draft.length > maxChars * 0.85 ? (
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.danger }}>{arDigits(maxChars - draft.length)}</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
              <View style={{ flex: 1, minHeight: 48, justifyContent: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.md }}>
                <TextInput
                  ref={input}
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => { if (!draft && mine?.body) setDraft(mine.body); }}
                  placeholder={mine ? t('threads.edit_answer') : t('threads.write_answer')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxLength={maxChars}
                  style={{ maxHeight: 130, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 23, color: colors.textPrimary, textAlign: 'right' }}
                />
              </View>
              <TouchableOpacity
                onPress={send}
                disabled={!draft.trim() || comment.isPending}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('threads.send')}
                style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: draft.trim() ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                {comment.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Icon name={mine ? 'check' : 'send'} size={20} color="#FFFFFF" style={mine ? undefined : { transform: [{ scaleX: -1 }] }} />}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ThreadVideoPlayer video={player} onClose={() => setPlayer(null)} />
      <MenuSheet menu={menu} onClose={() => setMenu(null)} />
      <ReportSheet
        visible={!!reportFor} reasons={data?.report_reasons ?? {}} pending={report.isPending} onClose={() => setReportFor(null)}
        onSubmit={(reason, note) => reportFor && report.mutate({ commentId: reportFor.id, reason, note }, {
          onSuccess: (msg) => { setReportFor(null); Alert.alert(t('threads.report'), msg); },
          onError: fail,
        })}
      />
      <TextSheet
        visible={!!hideFor} title={t('threads.hide')} subtitle={hideFor ? t('threads.hide_of', { name: hideFor.author.name }) : undefined} placeholder={t('threads.hide_reason')} confirm={t('threads.hide_confirm')} pending={hide.isPending}
        onClose={() => setHideFor(null)}
        onSubmit={(reason) => hideFor && hide.mutate({ commentId: hideFor.id, reason: reason || undefined }, { onSuccess: () => setHideFor(null), onError: fail })}
      />
      {thread ? <AnswerSheet visible={answerOpen} threadId={thread.id} maxSeconds={data?.limits.video_max_seconds ?? 120} onClose={() => setAnswerOpen(false)} onDone={() => { setAnswerOpen(false); haptic('success'); }} /> : null}
      <ExtendSheet visible={extendOpen} pending={extend.isPending} onClose={() => setExtendOpen(false)} onSubmit={(m) => extend.mutate(m, { onSuccess: () => setExtendOpen(false), onError: fail })} />
      <AudienceSheet videoId={audienceFor} onClose={() => setAudienceFor(null)} />
    </View>
  );
}

// ── The hero ────────────────────────────────────────────────────────────────

function BackChip() {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')}
      style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
      {/* RTL: back points right. */}
      <Icon name="forward" size={22} color={colors.onHero} />
    </TouchableOpacity>
  );
}

/** The hero's first row alone — while loading or on an error, so the page is never blank. */
function TopBar() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <BackChip />
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.onHero }}>{t('threads.title')}</Text>
      </View>
    </LinearGradient>
  );
}

function Hero({ thread, state, perms, isModerator, onMore, onPlay, onElapsed, onAnswer, onLock, onExtend }: {
  thread: Thread;
  state: ThreadState;
  perms: ThreadPermissions | undefined;
  isModerator: boolean;
  onMore?: () => void;
  onPlay: (v: ThreadVideo) => void;
  onElapsed: () => void;
  onAnswer: () => void;
  onLock: () => void;
  onExtend: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const note = state === 'note';
  const staffActions = isModerator && thread.kind === 'question' && (perms?.can_answer || perms?.can_lock || (perms?.can_extend && !thread.open));

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl4 }}>
      {/* Row 1: back, the feature's name, the post's menu */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <BackChip />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="threads" size={15} color={colors.onHeroSoft} outline />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onHeroSoft }}>{t('threads.title')}</Text>
        </View>
        {onMore ? (
          <TouchableOpacity onPress={onMore} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('threads.post_actions')}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="more" size={20} color={colors.onHero} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Row 2: who asked, which grade, when */}
      <Animated.View entering={FadeIn.duration(240)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
        <InitialsAvatar id={thread.teacher.id} name={thread.teacher.name} size={44} ring={colors.onHeroChipBorder} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onHero }} numberOfLines={1}>{thread.teacher.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 1, borderRadius: radius.full, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.onHero }} numberOfLines={1}>{thread.grade.name ?? '—'}</Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.onHeroSoft }}>{ago(thread.created_at)}</Text>
            {thread.audience_count !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon name="people" size={12} color={colors.onHeroSoft} outline />
                <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.onHeroSoft }}>{arDigits(thread.audience_count)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radius.full, backgroundColor: note ? colors.accentWarm : colors.brand }}>
          <Icon name={note ? 'lightbulb' : 'question'} size={14} color={colors.onPrimary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onPrimary }}>{note ? t('threads.note_badge') : t('threads.kind_question')}</Text>
        </View>
      </Animated.View>

      {/* The question */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {thread.title ? <Text selectable style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 35, color: colors.onHero }}>{thread.title}</Text> : null}
        {thread.body ? <Text selectable style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 26, color: colors.onHeroSoft }}>{thread.body}</Text> : null}
      </Animated.View>

      {thread.video ? (
        <View style={{ marginTop: spacing.md }}>
          <VideoBlock video={thread.video} onPlay={() => onPlay(thread.video!)} onHero />
        </View>
      ) : null}

      {/* The round: a ring that empties, or a seal once it is over */}
      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, gap: spacing.md }}>
        <RoundState thread={thread} state={state} staff={isModerator} onElapsed={onElapsed} />
        {staffActions ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {perms?.can_answer ? (
              <TouchableOpacity onPress={onAnswer} activeOpacity={0.85} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, backgroundColor: colors.success }}>
                <Icon name="teacher" size={17} color={colors.onPrimary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.onPrimary }}>{thread.answer ? t('threads.answer_again') : t('threads.answer_title')}</Text>
              </TouchableOpacity>
            ) : null}
            {perms?.can_lock ? <HeroAction icon="lock" label={t('threads.lock_short')} onPress={onLock} /> : null}
            {perms?.can_extend && !thread.open ? <HeroAction icon="timer" label={t('threads.extend')} onPress={onExtend} /> : null}
          </View>
        ) : null}
      </Animated.View>
    </LinearGradient>
  );
}

function HeroAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Icon name={icon} size={16} color={colors.textPrimary} outline />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** The ring while the clock runs; a coloured seal for every other state. */
function RoundState({ thread, state, staff, onElapsed }: { thread: Thread; state: ThreadState; staff: boolean; onElapsed: () => void }) {
  const { t } = useTranslation();
  const answers = t('threads.answers_so_far', { n: arDigits(thread.comments_count) });

  if (state === 'open' && thread.comments_close_at) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <CountdownRing
          createdAt={thread.created_at} endsAt={thread.comments_close_at} onElapsed={onElapsed}
          color={colors.brand} track={colors.onHeroChipBorder} ink={colors.onHero} soft={colors.onHeroSoft}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onHero }}>{t('threads.ring_caption')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.onHeroSoft }}>{answers}</Text>
          {thread.reveal_at_close ? <QuizChip /> : null}
        </View>
      </View>
    );
  }

  const seal: { icon: IconName; bg: string; title: string; sub: string } =
    state === 'open' ? { icon: 'timer', bg: colors.brand, title: t('threads.seal_open_free'), sub: answers }
      : state === 'answered' ? { icon: 'success', bg: colors.success, title: t('threads.seal_answered'), sub: thread.answered_at ? t('threads.answered_ago', { when: ago(thread.answered_at) }) : answers }
        : state === 'note' ? { icon: 'lightbulb', bg: colors.accentWarm, title: t('threads.seal_note'), sub: t('threads.seal_note_sub') }
          : { icon: 'hourglass', bg: colors.warning, title: state === 'locked' ? t('threads.seal_locked') : t('threads.seal_timer'), sub: staff ? t('threads.awaiting_answer_teacher') : t('threads.awaiting_answer') };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Animated.View entering={ZoomIn.duration(260)} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: seal.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.onHeroChipBorder }}>
        <Icon name={seal.icon} size={28} color={colors.onPrimary} />
      </Animated.View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onHero }}>{seal.title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.onHeroSoft }}>{seal.sub}</Text>
        {state === 'open' && thread.reveal_at_close ? <QuizChip /> : null}
      </View>
    </View>
  );
}

function QuizChip() {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder }}>
      <Icon name="lock" size={11} color={colors.onHero} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.onHero }}>{t('threads.quiz_hidden_badge')}</Text>
    </View>
  );
}

// ── Under the hero ──────────────────────────────────────────────────────────

/** The teacher's answer, pinned: green, the words, the vertical video. */
function AnswerCard({ thread, onPlay }: { thread: Thread; onPlay: (v: ThreadVideo) => void }) {
  const { t } = useTranslation();
  const a = thread.answer!;
  return (
    <Animated.View entering={FadeInDown.delay(80).duration(320)} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.success, overflow: 'hidden', ...shadows.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.successLight }}>
        <InitialsAvatar id={thread.teacher.id} name={thread.teacher.name} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.successText }}>{t('threads.teacher_answer')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.successText, opacity: 0.8 }}>{ago(a.created_at)}</Text>
        </View>
        <Icon name="success" size={22} color={colors.success} />
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {a.body ? <Text selectable style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 27, color: colors.textPrimary }}>{a.body}</Text> : null}
        {a.video ? <VideoBlock video={a.video} onPlay={() => onPlay(a.video!)} /> : null}
      </View>
    </Animated.View>
  );
}

/** A short vertical video: its tall poster with the play glyph, and what protects it. */
function VideoBlock({ video, onPlay, onHero }: { video: ThreadVideo; onPlay: () => void; onHero?: boolean }) {
  const { t } = useTranslation();
  const ink = onHero ? colors.onHero : colors.textPrimary;
  const soft = onHero ? colors.onHeroSoft : colors.textTertiary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <TouchableOpacity onPress={onPlay} disabled={video.expired} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('threads.video_watch')}>
        <PosterThumb video={video} width={96} />
      </TouchableOpacity>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: ink }}>{video.expired ? t('threads.video_expired') : t('threads.video_watch')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: soft }}>{t('threads.video_protected')}</Text>
        {!video.expired ? (
          <TouchableOpacity onPress={onPlay} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.md, height: 34, borderRadius: radius.full, backgroundColor: colors.brand }}>
            <Icon name="play" size={14} color={colors.onPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onPrimary }}>{t('threads.video_play')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/** Quiz mode, clock running: a friendly locked card in place of the classmates' answers. */
function QuizLocked() {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 66, height: 66 }}>
        <View style={{ position: 'absolute', top: 6, start: 6, width: 54, height: 54, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] }}>
          <Icon name="lock" size={26} color={colors.onPrimary} />
        </View>
        <View style={{ position: 'absolute', top: 0, end: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentWarm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.brandTint }}>
          <Icon name="sparkles" size={12} color={colors.onAccent} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{t('threads.answers_hidden_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{t('threads.answers_hidden_body')}</Text>
      </View>
    </Animated.View>
  );
}

function NoAnswers({ staff }: { staff: boolean }) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeIn.duration(260)} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border }}>
      <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: colors.accentWarmTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="sparkles" size={26} color={colors.accentWarm} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{staff ? t('threads.no_answers_teacher') : t('threads.no_answers')}</Text>
    </Animated.View>
  );
}

function Notice({ icon, tone, text }: { icon: IconName; tone: 'warning'; text: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: tone === 'warning' ? colors.warningLight : colors.surface, borderWidth: 1, borderColor: colors.warning }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={colors.warning} outline />
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.warningText }}>{text}</Text>
    </Animated.View>
  );
}

// ── An answer ───────────────────────────────────────────────────────────────

const CommentRow = memo(function CommentRow({ comment: c, index, canVote, downvotes, canEdit, onVote, onMenu, onEdit }: {
  comment: ThreadComment;
  index: number;
  canVote: boolean;
  downvotes: boolean;
  canEdit: boolean;
  onVote: (c: ThreadComment, v: -1 | 0 | 1) => void;
  onMenu: (c: ThreadComment) => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const me = c.author.is_me;
  const bg = c.hidden ? colors.dangerLight : c.picked ? colors.accentWarmTint : me ? colors.brandTint : colors.surface;
  const border = c.picked ? colors.accentWarm : me ? colors.brand : colors.borderLight;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 40).duration(260)}>
      <Pressable onLongPress={() => onMenu(c)} delayLongPress={320} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        <View style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: bg, borderRadius: radius.xl, borderWidth: c.picked || me ? 1.5 : 1, borderColor: border, padding: spacing.md }}>
          <InitialsAvatar id={c.author.id} name={c.author.name} size={38} ring={c.picked ? colors.accentWarm : null} />
          <View style={{ flex: 1, gap: 6 }}>
            {/* Name, badge, when, the menu */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: me ? colors.brand : colors.textPrimary }} numberOfLines={1}>
                {me ? t('threads.your_answer') : c.author.name}
              </Text>
              {c.picked ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, height: 22, borderRadius: 11, backgroundColor: colors.accentWarm }}>
                  <Icon name="star" size={11} color={colors.onAccent} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onAccent }}>{t('threads.picked')}</Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{ago(c.created_at)}{c.edited ? `  |  ${t('threads.edited')}` : ''}</Text>
              <TouchableOpacity onPress={() => onMenu(c)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('threads.comment_actions')} style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="more" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* The answer */}
            <Text selectable style={{ fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 25, color: c.hidden ? colors.textTertiary : colors.textPrimary, textDecorationLine: c.hidden ? 'line-through' : 'none' }}>
              {c.body ?? t('threads.hidden_by_teacher')}
            </Text>
            {c.hidden ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="eyeOff" size={12} color={colors.dangerText} outline />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 11.5, color: colors.dangerText }}>{t('threads.hidden')}{c.hidden_reason ? `: ${c.hidden_reason}` : ''}</Text>
              </View>
            ) : null}

            {/* Votes, and the reader's own edit */}
            {!c.hidden ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <VotePill comment={c} canVote={canVote} downvotes={downvotes} onVote={onVote} />
                <View style={{ flex: 1 }} />
                {canEdit ? (
                  <TouchableOpacity onPress={onEdit} hitSlop={6} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Icon name="pencil" size={13} color={colors.brand} outline />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{t('threads.edit_short')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/** Up / score / down in one pill. The score moves under the finger (useVoteThreadComment is optimistic). */
function VotePill({ comment: c, canVote, downvotes, onVote }: { comment: ThreadComment; canVote: boolean; downvotes: boolean; onVote: (c: ThreadComment, v: -1 | 0 | 1) => void }) {
  const { t } = useTranslation();
  const up = c.my_vote === 1;
  const down = c.my_vote === -1;
  const scoreInk = c.score > 0 ? colors.success : c.score < 0 ? colors.danger : colors.textSecondary;
  const idle = canVote ? colors.textSecondary : colors.textTertiary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: 16, backgroundColor: up ? colors.successLight : down ? colors.dangerLight : colors.surfaceSunken, borderWidth: 1, borderColor: up ? colors.success : down ? colors.danger : colors.borderLight, opacity: canVote || c.score !== 0 ? 1 : 0.7 }}>
      <TouchableOpacity onPress={() => onVote(c, up ? 0 : 1)} disabled={!canVote} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('threads.vote_up')} accessibilityState={{ selected: up, disabled: !canVote }}
        style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="voteUp" size={18} color={up ? colors.success : idle} outline={!up} />
      </TouchableOpacity>
      <Animated.Text key={c.score} entering={ZoomIn.duration(160)} style={{ minWidth: 22, textAlign: 'center', fontFamily: fonts.bold, fontSize: 14, color: scoreInk, fontVariant: ['tabular-nums'] }}>
        {c.score > 0 ? `+${arDigits(c.score)}` : c.score < 0 ? `-${arDigits(-c.score)}` : arDigits(0)}
      </Animated.Text>
      {downvotes ? (
        <TouchableOpacity onPress={() => onVote(c, down ? 0 : -1)} disabled={!canVote} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('threads.vote_down')} accessibilityState={{ selected: down, disabled: !canVote }}
          style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="voteDown" size={18} color={down ? colors.danger : idle} outline={!down} />
        </TouchableOpacity>
      ) : <View style={{ width: 10 }} />}
    </View>
  );
}

/** A small menu as a sheet: the post's actions, or one answer's. */
function MenuSheet({ menu, onClose }: { menu: { title: string; items: MenuItem[] } | null; onClose: () => void }) {
  return (
    <Sheet visible={!!menu} title={menu?.title ?? ''} icon="more" onClose={onClose}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
        {(menu?.items ?? []).map((m, i) => (
          <TouchableOpacity
            key={m.key}
            onPress={() => { onClose(); setTimeout(m.onPress, 220); }}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, minHeight: 54, borderTopWidth: i ? 1 : 0, borderTopColor: colors.borderLight }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: m.danger ? colors.dangerLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={m.icon} size={17} color={m.danger ? colors.danger : colors.brand} outline />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: m.danger ? colors.dangerText : colors.textPrimary }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Sheet>
  );
}

export type { Thread };
