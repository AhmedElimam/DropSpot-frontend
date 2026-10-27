import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, type StyleProp, type ViewStyle } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { ReportSheet, TextSheet } from '@/components/threads/ThreadSheets';
import { useMediaHeaders } from '@/components/threads/mediaHeaders';
import { arDigits } from '@/components/threads/format';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import {
  useCommunityFeed, useCommunitySpaces, useDeleteCommunityPost, useModerateCommunityPost, useReactToCommunityPost, useReportCommunityPost,
} from '@/hooks/useCommunity';
import type { CommunityAudience, CommunityPost, CommunityReaction, CommunitySpace } from '@/api/community';
import { PostCard, CARD_SIDE } from './PostCard';
import { ComposePostSheet } from './ComposePostSheet';

/**
 * One space's feed — the whole screen's list, so the rows are windowed (a FlatList, never a
 * ScrollView of cards). The caller's hero and segments come in as `header` and scroll with
 * the posts; under them the space's own cover (the teacher's face, the name, the members),
 * the «what's on your mind» composer and the posts, the way a social group page reads
 * (founder 2026-10-28: «huge love on the community UI»).
 *
 * What a row can do hangs off the role the server returned: a member reacts, comments,
 * reports, edits or withdraws their own; a moderator approves, rejects, hides, pins.
 */
export function CommunityFeed({ audience, header, footer, onOpen, onSpaceChange, contentContainerStyle, extraRefetch }: {
  audience: CommunityAudience;
  header?: ReactElement | null;
  /** After the last row (the beta note line). */
  footer?: ReactElement | null;
  onOpen: (postId: number) => void;
  /** The space in front changed (the teacher's queue and settings follow it). */
  onSpaceChange?: (space: CommunitySpace | undefined) => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** The caller's other queries to refresh on the same pull (the hub's badges). */
  extraRefetch?: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const headers = useMediaHeaders();
  const me = useAuthStore((s) => s.user);
  const meRole = useAuthStore((s) => s.role);
  const spacesQ = useCommunitySpaces();
  const spaces = useMemo(() => (spacesQ.data?.spaces ?? []).filter((s) => s.audience === audience), [spacesQ.data?.spaces, audience]);
  const [pickedTeacher, setPickedTeacher] = useState<number | null>(null);
  const space: CommunitySpace | undefined = spaces.find((s) => s.teacher_id === pickedTeacher) ?? spaces[0];
  const teacherId = space?.teacher_id ?? null;
  const feed = useCommunityFeed(teacherId, audience);
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.posts) ?? [], [feed.data?.pages]);
  const role = feed.data?.pages[0]?.role ?? space?.role ?? 'student';
  const moderator = role === 'teacher' || role === 'assistant';

  const react = useReactToCommunityPost();
  const moderate = useModerateCommunityPost();
  const remove = useDeleteCommunityPost();
  const report = useReportCommunityPost();
  const [composeOpen, setComposeOpen] = useState(false);
  const [reportFor, setReportFor] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<{ id: number; action: 'reject' | 'hide' } | null>(null);
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
    if (moderator) {
      if (post.status === 'held') {
        buttons.push({ text: t('community_space.approve'), onPress: () => run(() => moderate.mutateAsync({ postId: post.id, action: 'approve' })) });
        buttons.push({ text: t('community_space.reject'), style: 'destructive', onPress: () => setNoteFor({ id: post.id, action: 'reject' }) });
      }
      if (post.status === 'published') {
        if (role === 'teacher') buttons.push({ text: t(post.pinned ? 'community_space.unpin' : 'community_space.pin'), onPress: () => run(() => moderate.mutateAsync({ postId: post.id, action: post.pinned ? 'unpin' : 'pin' })) });
        if (!post.mine) buttons.push({ text: t('community_space.hide'), style: 'destructive', onPress: () => setNoteFor({ id: post.id, action: 'hide' }) });
      }
    }
    if (post.mine && post.status !== 'hidden') {
      buttons.push({ text: t('community_space.withdraw'), style: 'destructive', onPress: () => Alert.alert(t('community_space.withdraw'), t('community_space.withdraw_confirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('community_space.withdraw'), style: 'destructive', onPress: () => run(() => remove.mutateAsync({ postId: post.id })) }]) });
    }
    if (!post.mine && !moderator && post.status === 'published') {
      buttons.push({ text: t('community_space.report'), style: 'destructive', onPress: () => setReportFor(post.id) });
    }
    if (!buttons.length) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(post.author.name, undefined, buttons);
  }, [moderator, role, t, moderate, remove]);

  const onCreated = useCallback((post: CommunityPost) => {
    setComposeOpen(false);
    if (post.status === 'held') Alert.alert(t('community_space.held_title'), post.status_reason === 'awaiting_review' ? t('community_space.held_awaiting') : t('community_space.held_body', { why: post.status_note ?? '' }));
    else if (post.status === 'rejected') Alert.alert(t('community_space.rejected_title'), t('community_space.rejected_body', { why: post.status_note ?? '' }));
  }, [t]);

  useEffect(() => { onSpaceChange?.(space); }, [space?.teacher_id, space?.audience, space?.held]); // eslint-disable-line react-hooks/exhaustive-deps
  // The first space wins until the reader picks another; a vanished pick falls back.
  useEffect(() => { if (pickedTeacher !== null && !spaces.some((s) => s.teacher_id === pickedTeacher)) setPickedTeacher(null); }, [spaces, pickedTeacher]);

  const mySeed = meRole === 'student' && me?.student_id ? avatarSeed.student(me.student_id) : avatarSeed.user(me?.id);
  const firstName = (me?.name ?? '').split(' ')[0];

  const listHeader = (
    <View>
      {header}
      {space ? (
        <View style={{ marginHorizontal: CARD_SIDE, marginTop: spacing.sm, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, ...shadows.sm }}>
          {/* The cover: the brand ink, the teacher's face overlapping its bottom edge */}
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 84 }}>
            <View pointerEvents="none" style={{ position: 'absolute', top: -40, end: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: colors.accent, opacity: 0.18 }} />
            <View pointerEvents="none" style={{ position: 'absolute', bottom: -70, start: 40, width: 160, height: 160, borderRadius: 80, backgroundColor: '#FFFFFF', opacity: 0.06 }} />
          </LinearGradient>
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
            {/* Only the face overlaps the cover; the name sits below the edge. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, marginTop: -30, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface, ...shadows.md }}>
                {space.teacher_logo_url
                  ? <Image source={{ uri: space.teacher_logo_url }} style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.surfaceSunken }} contentFit="cover" />
                  : <GeneratedAvatar seed={avatarSeed.user(space.teacher_id)} size={62} label={space.teacher_name} />}
              </View>
              <View style={{ flex: 1, paddingTop: 8 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={1}>{t(audience === 'parents' ? 'community_space.space_parents_of' : 'community_space.space_students_of', { name: space.teacher_name })}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Icon name={audience === 'parents' ? 'people' : 'teacher'} size={13} color={colors.textTertiary} outline />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t(audience === 'parents' ? 'community_space.members_parents' : 'community_space.members_students', { n: arDigits(space.members) })}</Text>
                  {space.posts > 0 ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}> · {t('community_space.n_posts', { n: arDigits(space.posts) })}</Text> : null}
                </View>
              </View>
            </View>
            {spaces.length > 1 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                {spaces.map((s) => {
                  const on = s.teacher_id === teacherId;
                  return (
                    <TouchableOpacity key={s.teacher_id} onPress={() => setPickedTeacher(s.teacher_id)} activeOpacity={0.8} accessibilityRole="tab" accessibilityState={{ selected: on }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: on ? colors.brand : colors.surfaceSunken }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.onPrimary : colors.textSecondary }} numberOfLines={1}>{s.teacher_name}</Text>
                      {s.unread > 0 && !on ? <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.onPrimary }}>{arDigits(s.unread)}</Text></View> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            {space.welcome ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
                <Icon name="pin" size={14} color={colors.brand} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textPrimary }}>{space.welcome}</Text>
              </View>
            ) : null}
            {moderator && (space.held ?? 0) > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight }}>
                <Icon name="hourglass" size={16} color={colors.warningText} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningText }}>{t('community_space.held_count', { n: arDigits(space.held ?? 0) })}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* «What's on your mind» */}
      {space?.can_post ? (
        <View style={{ marginHorizontal: CARD_SIDE, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, gap: spacing.md, ...shadows.sm }}>
          <TouchableOpacity onPress={() => setComposeOpen(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('community_space.compose_title')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <GeneratedAvatar seed={mySeed} size={40} label={me?.name} />
            <View style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSunken, justifyContent: 'center', paddingHorizontal: spacing.lg }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary }} numberOfLines={1}>{t('community_space.whats_on_your_mind', { name: firstName })}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: colors.borderLight }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setComposeOpen(true)} activeOpacity={0.8} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34 }}>
              <Icon name="image" size={19} color={colors.success} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('community_space.add_photo')}</Text>
            </TouchableOpacity>
            <View style={{ width: 1, height: 22, backgroundColor: colors.borderLight }} />
            <TouchableOpacity onPress={() => setComposeOpen(true)} activeOpacity={0.8} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 34 }}>
              <Icon name="pencil" size={18} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('community_space.write_post')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : space ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: CARD_SIDE + spacing.sm, marginTop: spacing.md }}>
          <Icon name="lock" size={14} color={colors.textTertiary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>{t('community_space.read_only')}</Text>
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
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' }}>{t(space.can_post ? 'community_space.empty_body' : 'community_space.empty_body_readonly')}</Text>
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
      {teacherId && space ? (
        <ComposePostSheet visible={composeOpen} teacherId={teacherId} audience={audience} role={role} space={space} limits={spacesQ.data?.limits} onClose={() => setComposeOpen(false)} onCreated={onCreated} />
      ) : null}
      <ReportSheet
        visible={reportFor !== null}
        reasons={spacesQ.data?.limits?.report_reasons ?? {}}
        pending={report.isPending}
        onClose={() => setReportFor(null)}
        onSubmit={(reason, note) => { if (reportFor === null) return; report.mutate({ postId: reportFor, reason, note: note || undefined }, { onSuccess: () => { setReportFor(null); Alert.alert(t('community_space.reported_title'), t('community_space.reported_body')); }, onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }); }}
      />
      <TextSheet
        visible={noteFor !== null}
        title={t(noteFor?.action === 'reject' ? 'community_space.reject' : 'community_space.hide')}
        subtitle={t('community_space.note_sub')}
        placeholder={t('community_space.note_placeholder')}
        confirm={t(noteFor?.action === 'reject' ? 'community_space.reject' : 'community_space.hide')}
        pending={moderate.isPending}
        onClose={() => setNoteFor(null)}
        onSubmit={(note) => { if (!noteFor) return; moderate.mutate({ postId: noteFor.id, action: noteFor.action, note: note || undefined }, { onSuccess: () => setNoteFor(null), onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }); }}
      />
    </>
  );
}
