import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, type StyleProp, type ViewStyle } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { BetaChip } from '@/components/ui/Beta';
import { COMMUNITY_FLAG } from '@/hooks/useCommunity';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { ReportSheet } from '@/components/threads/ThreadSheets';
import { useMediaHeaders } from '@/components/threads/mediaHeaders';
import { arDigits } from '@/components/threads/format';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useCommunityFeed, useCommunitySpaces, useDeleteCommunityPost, useReactToCommunityPost, useReportCommunityPost } from '@/hooks/useCommunity';
import { canWrite, type CommunityAudience, type CommunityPost, type CommunityReaction, type CommunitySpace } from '@/api/community';
import { PostCard, CARD_SIDE } from './PostCard';
import { ComposePostSheet } from './ComposePostSheet';

/**
 * One community's feed — the whole screen's list, so the rows are windowed (a FlatList, never a
 * ScrollView of cards). The caller's hero and segments come in as `header` and scroll with
 * the posts; under them the community's cover (the brand, the name, how many members), the
 * «what's on your mind» composer and the posts, the way a social group page reads (founder
 * 2026-10-28: «huge love on the community UI» — and later that day: one open community of
 * all students, one of all parents, no community of a specific teacher).
 *
 * What a row can do hangs off the role the server returned: a member reacts, comments,
 * reports, edits or withdraws their own; a teacher reads, reacts and reports. Nobody
 * moderates from the app.
 */
export function CommunityFeed({ audience, header, footer, onOpen, contentContainerStyle, extraRefetch }: {
  audience: CommunityAudience;
  header?: ReactElement | null;
  /** After the last row (the beta note line). */
  footer?: ReactElement | null;
  onOpen: (postId: number) => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** The caller's other queries to refresh on the same pull (the hub's badges). */
  extraRefetch?: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const headers = useMediaHeaders();
  const me = useAuthStore((s) => s.user);
  const meRole = useAuthStore((s) => s.role);
  const spacesQ = useCommunitySpaces();
  const space: CommunitySpace | undefined = useMemo(() => (spacesQ.data?.spaces ?? []).find((s) => s.audience === audience), [spacesQ.data?.spaces, audience]);
  const feed = useCommunityFeed(audience);
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.posts) ?? [], [feed.data?.pages]);
  const role = feed.data?.pages[0]?.role ?? space?.role ?? 'student';
  const writer = canWrite(role);

  const react = useReactToCommunityPost();
  const remove = useDeleteCommunityPost();
  const report = useReportCommunityPost();
  const [composeOpen, setComposeOpen] = useState(false);
  const [reportFor, setReportFor] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([feed.refetch(), spacesQ.refetch(), extraRefetch?.()]); } finally { setRefreshing(false); }
  }, [feed, spacesQ, extraRefetch]);

  const onReact = useCallback((id: number, kind: CommunityReaction) => { react.mutate({ postId: id, kind }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }); }, [react]);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const open = useCallback((id: number) => openRef.current(id), []);
  const openImage = useCallback((post: CommunityPost) => openRef.current(post.id), []);

  const onMore = useCallback((post: CommunityPost) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    const run = (fn: () => Promise<unknown>) => fn().catch((e) => Alert.alert('', getFriendlyErrorMessage(e)));
    if (post.mine && post.status !== 'hidden') {
      buttons.push({ text: t('community_space.withdraw'), style: 'destructive', onPress: () => Alert.alert(t('community_space.withdraw'), t('community_space.withdraw_confirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('community_space.withdraw'), style: 'destructive', onPress: () => run(() => remove.mutateAsync({ postId: post.id })) }]) });
    }
    if (!post.mine && post.status === 'published') {
      buttons.push({ text: t('community_space.report'), style: 'destructive', onPress: () => setReportFor(post.id) });
    }
    if (!buttons.length) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(post.author.name, undefined, buttons);
  }, [t, remove]);

  const onCreated = useCallback((post: CommunityPost) => {
    setComposeOpen(false);
    if (post.status === 'held') Alert.alert(t('community_space.held_title'), post.status_reason === 'awaiting_review' ? t('community_space.held_awaiting') : t('community_space.held_body', { why: post.status_note ?? '' }));
    else if (post.status === 'rejected') Alert.alert(t('community_space.rejected_title'), t('community_space.rejected_body', { why: post.status_note ?? '' }));
  }, [t]);

  const mySeed = meRole === 'student' && me?.student_id ? avatarSeed.student(me.student_id) : avatarSeed.user(me?.id);
  const firstName = (me?.name ?? '').split(' ')[0];
  const parents = audience === 'parents';

  const canCompose = !!space && writer && space.can_post;
  const listHeader = (
    <View>
      {header}
      {/* One compact card (founder 2026-10-28: «the banner swallows a huge chunk of space»): the
          community's name and size on top, the «بم تفكر؟» line under it for a member. */}
      {space ? (
        <View style={{ marginHorizontal: CARD_SIDE, marginTop: spacing.sm, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, ...shadows.sm }}>
          <LinearGradient colors={[colors.brandTint, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
              <BrandMark size={26} tint="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              {/* RTL: 'row' only — the «تجريبي» mark trails the name (the screen's one chip). */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{t(parents ? 'community_space.title_parents' : 'community_space.title_students')}</Text>
                <BetaChip feature={COMMUNITY_FLAG} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <Icon name="people" size={12} color={colors.textTertiary} outline />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t(parents ? 'community_space.members_parents' : 'community_space.members_students', { n: arDigits(space.members) })}</Text>
                {/* A thin bar, not «·»: a middle dot beside Arabic digits reads as a zero. */}
                {space.posts > 0 ? <View style={{ width: 1, height: 11, marginHorizontal: 4, backgroundColor: colors.border }} /> : null}
                {space.posts > 0 ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('community_space.n_posts', { n: arDigits(space.posts) })}</Text> : null}
              </View>
            </View>
          </LinearGradient>

          {space.welcome ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandTint }}>
              <Icon name="pin" size={13} color={colors.brand} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textPrimary }} numberOfLines={3}>{space.welcome}</Text>
            </View>
          ) : null}

          {canCompose ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <GeneratedAvatar seed={mySeed} size={36} label={me?.name} />
              <TouchableOpacity onPress={() => setComposeOpen(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('community_space.compose_title')}
                style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: colors.surfaceSunken, justifyContent: 'center', paddingHorizontal: spacing.md }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textTertiary }} numberOfLines={1}>{t('community_space.whats_on_your_mind', { name: firstName })}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setComposeOpen(true)} hitSlop={6} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('community_space.add_photo')}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="image" size={18} color={colors.success} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <Icon name={writer ? 'lock' : 'eye'} size={14} color={colors.textTertiary} outline />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary }}>{t(writer ? 'community_space.read_only' : 'community_space.reader_note')}</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );

  const empty = !feed.isLoading && posts.length === 0;

  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: CARD_SIDE, paddingTop: spacing.sm }}>
            <PostCard post={item} role={role} headers={headers} onOpen={open} onReact={onReact} onMore={onMore} onOpenImage={openImage} />
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={feed.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl4 }} /> : spacesQ.isLoading || !space ? null : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl4, paddingHorizontal: spacing.xl, gap: spacing.sm }}>
            <Icon name="people" size={36} color={colors.textTertiary} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('community_space.empty_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' }}>{t(canCompose ? 'community_space.empty_body' : 'community_space.empty_body_readonly')}</Text>
          </View>
        )}
        ListFooterComponent={<View>{feed.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} /> : empty ? null : <View style={{ height: spacing.lg }} />}{footer}</View>}
        onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        windowSize={7}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        removeClippedSubviews
      />
      {space && writer ? (
        <ComposePostSheet visible={composeOpen} audience={audience} limits={spacesQ.data?.limits} onClose={() => setComposeOpen(false)} onCreated={onCreated} />
      ) : null}
      <ReportSheet
        visible={reportFor !== null}
        reasons={spacesQ.data?.limits?.report_reasons ?? {}}
        pending={report.isPending}
        onClose={() => setReportFor(null)}
        onSubmit={(reason, note) => { if (reportFor === null) return; report.mutate({ postId: reportFor, reason, note: note || undefined }, { onSuccess: () => { setReportFor(null); Alert.alert(t('community_space.reported_title'), t('community_space.reported_body')); }, onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }); }}
      />
    </>
  );
}
