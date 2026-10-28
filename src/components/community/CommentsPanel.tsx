import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Keyboard, Platform, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { arDigits } from '@/components/threads/format';
import { useMediaHeaders } from '@/components/threads/mediaHeaders';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useCommunityComments, useCommunitySpaces, useDeleteCommunityComment, useReportCommunityComment } from '@/hooks/useCommunity';
import { canWrite, type CommunityAudience, type CommunityComment, type CommunityRole } from '@/api/community';
import { CommentRow } from './CommentRow';
import { CommentComposer } from './CommentComposer';

/**
 * A thread in a panel (founder 2026-10-28: «instead of a page for comments, show a modal first,
 * then view all comments, and load more»): the first page of the post's comments — or of one
 * picture's (`mediaId`) — the composer under it, and either «عرض كل التعليقات» (the post page,
 * `onViewAll`) or «تحميل المزيد» here when there is no page to go to.
 *
 * A windowed list (never a ScrollView of rows). The keyboard is handled here, not by the sheet:
 * the sheet's own keyboard mode wraps its content in a ScrollView, which a list must not sit in.
 */
export function CommentsPanel({ postId, audience, mediaId = null, role, total, height, onViewAll }: {
  postId: number;
  audience: CommunityAudience;
  mediaId?: number | null;
  role: CommunityRole;
  /** The thread's count as the card knows it (the header line). */
  total: number;
  /** The panel's height before the keyboard. */
  height: number;
  onViewAll?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headers = useMediaHeaders();
  const spaces = useCommunitySpaces();
  const space = (spaces.data?.spaces ?? []).find((s) => s.audience === audience);
  const thread = useCommunityComments(postId, mediaId);
  const comments = useMemo(() => thread.data?.pages.flatMap((p) => p.comments) ?? [], [thread.data?.pages]);
  const writer = canWrite(role);
  const open = writer && (space?.comments_on ?? true);
  const remove = useDeleteCommunityComment();
  const report = useReportCommunityComment();
  const reasons = spaces.data?.limits?.report_reasons ?? {};

  // The keyboard lifts the composer; the list gives up the room.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKb(Math.max(0, e.endCoordinates.height - insets.bottom)));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]);

  const onMore = useCallback((c: CommunityComment) => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (c.mine && c.status !== 'hidden') {
      buttons.push({ text: t('community_space.withdraw'), style: 'destructive', onPress: () => remove.mutate({ commentId: c.id }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }) });
    }
    if (!c.mine && c.status === 'published') {
      // The reasons as the choices: no second sheet over this one.
      for (const [key, label] of Object.entries(reasons)) {
        buttons.push({ text: `${t('community_space.report')}: ${label}`, onPress: () => report.mutate({ commentId: c.id, reason: key }, {
          onSuccess: () => Alert.alert(t('community_space.reported_title'), t('community_space.reported_body')),
          onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)),
        }) });
      }
    }
    if (!buttons.length) return;
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(c.author.name, undefined, buttons);
  }, [t, remove, report, reasons]);

  const more = thread.hasNextPage;
  const footer = thread.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} /> : more ? (
    <TouchableOpacity onPress={() => (onViewAll ? onViewAll() : void thread.fetchNextPage())} activeOpacity={0.8} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginVertical: spacing.md, paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t(onViewAll ? 'community_space.view_all_comments' : 'community_space.load_more', { n: arDigits(total) })}</Text>
      <Icon name="back" size={14} color={colors.brand} />
    </TouchableOpacity>
  ) : null;

  return (
    <View style={{ height: height, paddingBottom: kb }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <Icon name="chat" size={18} color={colors.textSecondary} outline />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>
          {total > 0 ? t('community_space.n_comments', { n: arDigits(total) }) : t('community_space.comments')}
        </Text>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={comments}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <CommentRow comment={item} headers={headers} onMore={onMore} />}
        ListEmptyComponent={thread.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', marginVertical: spacing.xl }}>{t('community_space.no_comments')}</Text>
        )}
        ListFooterComponent={footer}
        onEndReached={() => { if (!onViewAll && thread.hasNextPage && !thread.isFetchingNextPage) void thread.fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingVertical: spacing.sm }}
        windowSize={7}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
      />
      {open ? (
        <View style={{ paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          <CommentComposer postId={postId} audience={audience} mediaId={mediaId} maxChars={spaces.data?.limits?.comment_max_chars ?? 1000} />
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'center', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
          {t(writer ? 'community_space.comments_off' : 'community_space.reader_note')}
        </Text>
      )}
    </View>
  );
}
