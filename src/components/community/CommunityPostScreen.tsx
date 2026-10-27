import { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { ErrorState } from '@/components/ui/ErrorState';
import { CommunityAvatar } from './CommunityAvatar';
import { ReportSheet } from '@/components/threads/ThreadSheets';
import { useMediaHeaders } from '@/components/threads/mediaHeaders';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { useAuthStore } from '@/stores/authStore';
import { ago } from '@/components/threads/format';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  useCommentOnCommunityPost, useCommunityPost, useCommunitySpaces, useDeleteCommunityComment, useDeleteCommunityPost,
  useReactToCommunityPost, useReportCommunityComment, useReportCommunityPost,
} from '@/hooks/useCommunity';
import { canWrite, type CommunityComment, type CommunityPost, type CommunityReaction, type CommunityRole } from '@/api/community';
import { PostCard, roleLabel, CARD_SIDE } from './PostCard';
import { arDigits } from '@/components/threads/format';

/**
 * One post, one screen, every role: the post in full on top, the comments under it, and a
 * composer pinned to the bottom while comments are open and the reader is a member (a
 * teacher reads, reacts and reports). What a row can do hangs off the role the server
 * returned — the client never guesses.
 */
export function CommunityPostScreen({ postId }: { postId: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headers = useMediaHeaders();
  const me = useAuthStore((s) => s.user);
  const meRole = useAuthStore((s) => s.role);
  const mySeed = meRole === 'student' && me?.student_id ? avatarSeed.student(me.student_id) : avatarSeed.user(me?.id);
  const { data, isLoading, isError, error, refetch } = useCommunityPost(postId);
  const notFound = (error as { response?: { status?: number } } | null)?.response?.status === 404;
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const spaces = useCommunitySpaces();
  const role: CommunityRole = data?.role ?? 'student';
  const writer = canWrite(role);
  const space = useMemo(() => (spaces.data?.spaces ?? []).find((s) => s.audience === data?.post.audience), [spaces.data?.spaces, data?.post.audience]);
  const commentsOpen = !!data && data.post.status === 'published' && writer && (space?.comments_on ?? true);

  const react = useReactToCommunityPost();
  const removePost = useDeleteCommunityPost();
  const removeComment = useDeleteCommunityComment();
  const reportPost = useReportCommunityPost();
  const reportComment = useReportCommunityComment();
  const comment = useCommentOnCommunityPost(postId);
  const [text, setText] = useState('');
  const [reportFor, setReportFor] = useState<{ kind: 'post' | 'comment'; id: number } | null>(null);
  const run = (fn: () => Promise<unknown>) => fn().catch((e) => Alert.alert('', getFriendlyErrorMessage(e)));

  const onReact = useCallback((id: number, kind: CommunityReaction) => { react.mutate({ postId: id, kind }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }); }, [react]);

  const onMorePost = useCallback((post: CommunityPost) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (post.mine && post.status !== 'hidden') buttons.push({ text: t('community_space.withdraw'), style: 'destructive', onPress: () => Alert.alert(t('community_space.withdraw'), t('community_space.withdraw_confirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('community_space.withdraw'), style: 'destructive', onPress: () => run(() => removePost.mutateAsync({ postId: post.id })) }]) });
    if (!post.mine && post.status === 'published') buttons.push({ text: t('community_space.report'), style: 'destructive', onPress: () => setReportFor({ kind: 'post', id: post.id }) });
    if (!buttons.length) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(post.author.name, undefined, buttons);
  }, [t, removePost]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMoreComment = useCallback((c: CommunityComment) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (c.mine && c.status !== 'hidden') buttons.push({ text: t('community_space.withdraw'), style: 'destructive', onPress: () => run(() => removeComment.mutateAsync({ commentId: c.id })) });
    if (!c.mine && c.status === 'published') buttons.push({ text: t('community_space.report'), style: 'destructive', onPress: () => setReportFor({ kind: 'comment', id: c.id }) });
    if (!buttons.length) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(c.author.name, undefined, buttons);
  }, [t, removeComment]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const body = text.trim();
    if (!body) return;
    comment.mutate(body, {
      onSuccess: (res) => {
        setText('');
        if (res.comment.status === 'held') Alert.alert(t('community_space.held_title'), res.comment.status_reason === 'awaiting_review' ? t('community_space.held_awaiting') : t('community_space.held_body', { why: res.comment.status_note ?? '' }));
        else if (res.comment.status === 'rejected') Alert.alert(t('community_space.rejected_title'), t('community_space.rejected_body', { why: res.comment.status_note ?? '' }));
      },
      onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)),
    });
  };

  const header = (
    <View>
      <PageHero onBack compact title={data?.post.author.name ?? t('community_space.post')} subtitle={data ? (data.post.audience === 'parents' ? t('community_space.title_parents') : t('community_space.title_students')) : undefined} />
      <View style={{ paddingHorizontal: CARD_SIDE, paddingTop: spacing.md }}>
        {data ? <PostCard post={data.post} role={role} headers={headers} onReact={onReact} onMore={onMorePost} expanded /> : null}
        {data && data.post.status === 'published' ? (
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs, marginHorizontal: spacing.sm }}>
            {data.comments.length ? t('community_space.n_comments', { n: arDigits(data.comments.length) }) : t('community_space.no_comments')}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (isError && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PageHero onBack compact title={t('community_space.post')} />
        {notFound ? <View style={{ padding: spacing.xl, alignItems: 'center' }}><Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>{t('community_space.post_gone')}</Text></View> : <ErrorState onRetry={() => refetch()} />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={data?.comments ?? []}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <CommentRow comment={item} onMore={onMoreComment} />}
        ListHeaderComponent={header}
        ListEmptyComponent={isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl4 }} /> : null}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        windowSize={7}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
      />
      {commentsOpen ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <View style={{ paddingBottom: 3 }}><GeneratedAvatar seed={mySeed} size={34} label={me?.name} /></View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('community_space.comment_placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={spaces.data?.limits?.comment_max_chars ?? 1000}
            style={{ flex: 1, minHeight: 40, maxHeight: 120, paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.surfaceSunken, fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right' }}
          />
          <TouchableOpacity onPress={send} disabled={!text.trim() || comment.isPending} accessibilityRole="button" accessibilityLabel={t('community_space.send')}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? colors.brand : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            {comment.isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="send" size={19} color={text.trim() ? colors.onPrimary : colors.textTertiary} />}
          </TouchableOpacity>
        </View>
      ) : data && data.post.status === 'published' ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'center' }}>{t(writer ? 'community_space.comments_off' : 'community_space.reader_note')}</Text>
        </View>
      ) : null}
      <ReportSheet
        visible={reportFor !== null}
        reasons={spaces.data?.limits?.report_reasons ?? {}}
        pending={reportPost.isPending || reportComment.isPending}
        onClose={() => setReportFor(null)}
        onSubmit={(reason, note) => {
          if (!reportFor) return;
          const done = { onSuccess: () => { setReportFor(null); Alert.alert(t('community_space.reported_title'), t('community_space.reported_body')); }, onError: (e: unknown) => Alert.alert('', getFriendlyErrorMessage(e)) };
          if (reportFor.kind === 'post') reportPost.mutate({ postId: reportFor.id, reason, note: note || undefined }, done);
          else reportComment.mutate({ commentId: reportFor.id, reason, note: note || undefined }, done);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const CommentRow = memo(function CommentRow({ comment: c, onMore }: { comment: CommunityComment; onMore: (c: CommunityComment) => void }) {
  const { t } = useTranslation();
  const chip = roleLabel(c.author.role, t);
  const status = c.status !== 'published' ? c.status : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: CARD_SIDE + spacing.sm, paddingVertical: 6 }}>
      <CommunityAvatar author={c.author} size={34} />
      <View style={{ flex: 1 }}>
        <Pressable onLongPress={() => onMore(c)} delayLongPress={300} style={{ alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: status ? (status === 'rejected' ? colors.dangerLight : colors.warningLight) : colors.surfaceSunken, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{c.author.name}</Text>
            {chip ? <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.brand }}>{chip}</Text> : null}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary }}>{c.body}</Text>
          {status ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: status === 'rejected' ? colors.dangerText : colors.warningText, marginTop: 2 }}>
              {t(status === 'rejected' ? 'community_space.status_rejected' : c.status_reason === 'awaiting_review' ? 'community_space.status_awaiting' : 'community_space.status_held')}{c.status_note ? ` — ${c.status_note}` : ''}
            </Text>
          ) : null}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 3, marginHorizontal: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{ago(c.created_at)}</Text>
          <TouchableOpacity onPress={() => onMore(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('community_space.more')}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary }}>{t('community_space.more')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});
