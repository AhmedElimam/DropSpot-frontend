import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { ErrorState } from '@/components/ui/ErrorState';
import { ReportSheet } from '@/components/threads/ThreadSheets';
import { useMediaHeaders } from '@/components/threads/mediaHeaders';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { Alert } from '@/ui/dialog';
import { arDigits } from '@/components/threads/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  useCommunityComments, useCommunityPost, useCommunitySpaces, useDeleteCommunityComment, useDeleteCommunityPost,
  useReactToCommunityPost, useReportCommunityComment, useReportCommunityPost, useBlockCommunityMember,
} from '@/hooks/useCommunity';
import { canWrite, type CommunityComment, type CommunityMedia, type CommunityPost, type CommunityReaction, type CommunityRole } from '@/api/community';
import { PostCard, CARD_SIDE } from './PostCard';
import { CommentRow } from './CommentRow';
import { CommentComposer } from './CommentComposer';
import { PostMediaViewer } from './PostMediaViewer';
import { canBlock, confirmBlock, pausedLine } from './guard';
import { ShareSheet } from './ShareSheet';
import { Surface } from '@/ui/surfaces';

/**
 * A menu choice that opens a sheet waits until the menu's own window has closed: the popup runs
 * the choice at once and leaves 150 ms later, and a sheet presented in that moment may never
 * appear (founder 2026-10-28: the report popup did not show).
 */
const afterPopup = (fn: () => void) => { setTimeout(fn, 320); };

/**
 * «عرض كل التعليقات» — one post, every comment (founder 2026-10-28: the sheet comes first; this
 * page shows them all, a page at a time — «load more» at the end). The post in full on top, its
 * pictures open in the in-app viewer (each with its own reactions and thread), the composer pinned
 * to the bottom for a member. What a row can do hangs off the role the server returned.
 */
export function CommunityPostScreen({ postId }: { postId: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headers = useMediaHeaders();
  const { data, isError, error, refetch } = useCommunityPost(postId);
  const thread = useCommunityComments(postId);
  const comments = useMemo(() => thread.data?.pages.flatMap((p) => p.comments) ?? [], [thread.data?.pages]);
  const notFound = (error as { response?: { status?: number } } | null)?.response?.status === 404;
  const spaces = useCommunitySpaces();
  const role: CommunityRole = data?.role ?? 'student';
  const writer = canWrite(role);
  const space = useMemo(() => (spaces.data?.spaces ?? []).find((s) => s.audience === data?.post.audience), [spaces.data?.spaces, data?.post.audience]);
  const member = writer && role !== 'staff';
  const paused = member ? pausedLine(spaces.data?.standing, t) : null;
  const commentsOpen = !!data && data.post.status === 'published' && writer && (space?.comments_on ?? true) && !paused;
  const block = useBlockCommunityMember();
  const blockAuthor = (author: CommunityPost['author'], from: { post_id?: number; comment_id?: number }) => afterPopup(() => confirmBlock(author, t, (userId) => block.mutateAsync({ userId, block: true, from })));

  const react = useReactToCommunityPost();
  const removePost = useDeleteCommunityPost();
  const removeComment = useDeleteCommunityComment();
  const reportPost = useReportCommunityPost();
  const reportComment = useReportCommunityComment();
  const [reportFor, setReportFor] = useState<{ kind: 'post' | 'comment'; id: number } | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [picture, setPicture] = useState<CommunityMedia | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [shareFor, setShareFor] = useState<CommunityPost | null>(null);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([refetch(), thread.refetch()]); } finally { setRefreshing(false); }
  }, [refetch, thread]);
  const run = (fn: () => Promise<unknown>) => fn().catch((e) => Alert.alert('', getFriendlyErrorMessage(e)));

  const onReact = useCallback((id: number, kind: CommunityReaction) => { react.mutate({ postId: id, kind }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }); }, [react]);
  const onOpenImage = useCallback((_p: CommunityPost, index: number) => setViewer(index), []);

  const onMorePost = useCallback((post: CommunityPost) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (post.mine && post.status !== 'hidden') buttons.push({ text: t('community_space.withdraw'), style: 'destructive', onPress: () => Alert.alert(t('community_space.withdraw'), t('community_space.withdraw_confirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('community_space.withdraw'), style: 'destructive', onPress: () => run(() => removePost.mutateAsync({ postId: post.id })) }]) });
    if (!post.mine && post.status === 'published') buttons.push({ text: t('community_space.report_menu'), style: 'destructive', onPress: () => afterPopup(() => setReportFor({ kind: 'post', id: post.id })) });
    if (canBlock(post.author, post.mine, member)) buttons.push({ text: t('community_space.block_menu', { name: post.author.name.split(' ')[0] }), onPress: () => blockAuthor(post.author, { post_id: post.id }) });
    if (!buttons.length) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(post.author.name, undefined, buttons);
  }, [t, removePost, member]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMoreComment = useCallback((c: CommunityComment) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (c.mine && c.status !== 'hidden') buttons.push({ text: t('community_space.withdraw'), style: 'destructive', onPress: () => run(() => removeComment.mutateAsync({ commentId: c.id })) });
    if (!c.mine && c.status === 'published') buttons.push({ text: t('community_space.report_menu'), style: 'destructive', onPress: () => afterPopup(() => setReportFor({ kind: 'comment', id: c.id })) });
    if (canBlock(c.author, c.mine, member)) buttons.push({ text: t('community_space.block_menu', { name: c.author.name.split(' ')[0] }), onPress: () => blockAuthor(c.author, { comment_id: c.id }) });
    if (!buttons.length) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(c.author.name, undefined, buttons);
  }, [t, removeComment, member]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = data?.post.comments_count ?? 0;
  const header = (
    <View>
      <PageHero onBack compact title={data?.post.author.name ?? t('community_space.post')} subtitle={data ? (data.post.audience === 'parents' ? t('community_space.title_parents') : t('community_space.title_students')) : undefined} />
      <View style={{ paddingHorizontal: CARD_SIDE, paddingTop: spacing.md }}>
        {data ? <PostCard post={data.post} role={role} headers={headers} onReact={onReact} onMore={onMorePost} onOpenImage={onOpenImage} onShare={setShareFor} expanded /> : null}
        {data && data.post.status === 'published' ? (
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs, marginHorizontal: spacing.sm }}>
            {total ? t('community_space.n_comments', { n: arDigits(total) }) : t('community_space.no_comments')}
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

  // «تحميل المزيد» at the end; scrolling there loads the next page by itself too.
  const footer = thread.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : thread.hasNextPage ? (
    <TouchableOpacity onPress={() => void thread.fetchNextPage()} activeOpacity={0.8} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginVertical: spacing.lg, paddingHorizontal: spacing.lg, height: 38, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('community_space.load_more')}</Text>
      <Icon name="down" size={14} color={colors.brand} />
    </TouchableOpacity>
  ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={data?.post.status === 'published' ? comments : []}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <CommentRow comment={item} headers={headers} onMore={onMoreComment} onOpenPicture={setPicture} side={CARD_SIDE + spacing.sm} />}
        ListHeaderComponent={header}
        ListEmptyComponent={thread.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl4 }} /> : null}
        ListFooterComponent={footer}
        onEndReached={() => { if (thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        windowSize={7}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
      />
      {commentsOpen && data ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <CommentComposer postId={postId} audience={data.post.audience} maxChars={spaces.data?.limits?.comment_max_chars ?? 1000} />
        </View>
      ) : data && data.post.status === 'published' ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'center' }}>{paused ?? t(writer ? 'community_space.comments_off' : 'community_space.reader_note')}</Text>
        </View>
      ) : null}
      {viewer !== null && data ? <PostMediaViewer post={data.post} start={viewer} role={role} headers={headers} onClose={() => setViewer(null)} /> : null}
      {picture ? <ImageViewer visible url={picture.url} headers={headers ?? {}} name={null} onClose={() => setPicture(null)} /> : null}
      <Surface id="community.post.share"><ShareSheet post={shareFor} onClose={() => setShareFor(null)} /></Surface>
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
