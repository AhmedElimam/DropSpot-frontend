import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { FlatList } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { PageHero } from '@/components/ui/PageHero';
import { TextSheet } from '@/components/threads/ThreadSheets';
import { useMediaHeaders } from '@/components/threads/mediaHeaders';
import { ago } from '@/components/threads/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useCommunityQueue, useModerateCommunityComment, useModerateCommunityPost, useReactToCommunityPost, useResolveCommunityReport } from '@/hooks/useCommunity';
import type { CommunityComment, CommunityPost, CommunityReport, ReportResolution } from '@/api/community';
import { PostCard } from './PostCard';

type Row =
  | { type: 'section'; key: string; title: string; n: number }
  | { type: 'post'; key: string; post: CommunityPost; held: boolean }
  | { type: 'comment'; key: string; comment: CommunityComment }
  | { type: 'report'; key: string; report: CommunityReport };

/**
 * The moderators' queue for one teacher: what the screen held, what it let through flagged,
 * and the open reports — each with its answers right on the row. One list, windowed.
 */
export function CommunityQueueScreen({ teacherId }: { teacherId: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headers = useMediaHeaders();
  const { data, isLoading, refetch } = useCommunityQueue(teacherId);
  const { refreshing, onRefresh } = usePullRefresh(refetch);
  const moderatePost = useModerateCommunityPost();
  const moderateComment = useModerateCommunityComment();
  const resolve = useResolveCommunityReport();
  const react = useReactToCommunityPost();
  const [noteFor, setNoteFor] = useState<{ kind: 'post' | 'comment' | 'report'; id: number; action: string } | null>(null);
  const run = (fn: () => Promise<unknown>) => fn().catch((e) => Alert.alert('', getFriendlyErrorMessage(e)));

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const out: Row[] = [];
    const section = (key: string, title: string, n: number) => { if (n > 0) out.push({ type: 'section', key, title, n }); };
    section('held_posts', t('community_space.section_held_posts'), data.held_posts.length);
    data.held_posts.forEach((p) => out.push({ type: 'post', key: `hp${p.id}`, post: p, held: true }));
    section('held_comments', t('community_space.section_held_comments'), data.held_comments.length);
    data.held_comments.forEach((c) => out.push({ type: 'comment', key: `hc${c.id}`, comment: c }));
    section('flagged', t('community_space.section_flagged'), data.flagged_posts.length);
    data.flagged_posts.forEach((p) => out.push({ type: 'post', key: `fp${p.id}`, post: p, held: false }));
    section('reports', t('community_space.section_reports'), data.reports.length);
    data.reports.forEach((r) => out.push({ type: 'report', key: `r${r.id}`, report: r }));
    return out;
  }, [data, t]);

  const onMore = useCallback((post: CommunityPost) => { router.push(`/(teacher)/conversations/community/${post.id}` as Href); }, []);
  const onReact = useCallback((id: number, kind: Parameters<typeof react.mutate>[0]['kind']) => { react.mutate({ postId: id, kind }); }, [react]);

  const Btn = ({ label, tone, onPress }: { label: string; tone: 'ok' | 'warn' | 'danger' | 'plain'; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button"
      style={{ height: 34, paddingHorizontal: spacing.md, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'ok' ? colors.successLight : tone === 'warn' ? colors.warningLight : tone === 'danger' ? colors.dangerLight : colors.surfaceSunken }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: tone === 'ok' ? colors.successText : tone === 'warn' ? colors.warningText : tone === 'danger' ? colors.dangerText : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'section') {
      return <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xs }}>{item.title} · {item.n}</Text>;
    }
    if (item.type === 'post') {
      const p = item.post;
      return (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
          <PostCard post={p} role="teacher" headers={headers} onOpen={(id) => router.push(`/(teacher)/conversations/community/${id}` as Href)} onReact={onReact} onMore={onMore} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {item.held ? <Btn label={t('community_space.approve')} tone="ok" onPress={() => run(() => moderatePost.mutateAsync({ postId: p.id, action: 'approve' }))} /> : null}
            {item.held ? <Btn label={t('community_space.reject')} tone="danger" onPress={() => setNoteFor({ kind: 'post', id: p.id, action: 'reject' })} /> : null}
            {!item.held ? <Btn label={t('community_space.hide')} tone="danger" onPress={() => setNoteFor({ kind: 'post', id: p.id, action: 'hide' })} /> : null}
          </View>
        </View>
      );
    }
    if (item.type === 'comment') {
      const c = item.comment;
      return (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{c.author.name}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{ago(c.created_at)}</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textPrimary }}>{c.body}</Text>
          {c.status_note ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningText }}>{c.status_note}</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Btn label={t('community_space.approve')} tone="ok" onPress={() => run(() => moderateComment.mutateAsync({ commentId: c.id, action: 'approve' }))} />
            <Btn label={t('community_space.reject')} tone="danger" onPress={() => setNoteFor({ kind: 'comment', id: c.id, action: 'reject' })} />
            <Btn label={t('community_space.open_post')} tone="plain" onPress={() => router.push(`/(teacher)/conversations/community/${c.post_id}` as Href)} />
          </View>
        </View>
      );
    }
    const r = item.report;
    return (
      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger, borderStartWidth: 4, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="flag" size={15} color={colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText, flex: 1 }}>{r.reason_label}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{ago(r.created_at)}</Text>
        </View>
        {r.reported_user ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('community_space.reported_user', { name: r.reported_user.name })}</Text> : null}
        {r.captured_body ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textPrimary }} numberOfLines={6}>«{r.captured_body}»</Text> : null}
        {r.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{t('community_space.reporter_note')}: {r.note}</Text> : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Btn label={t('community_space.dismiss')} tone="plain" onPress={() => run(() => resolve.mutateAsync({ reportId: r.id, action: 'dismiss' }))} />
          <Btn label={t('community_space.warn')} tone="warn" onPress={() => setNoteFor({ kind: 'report', id: r.id, action: 'warn' })} />
          <Btn label={t('community_space.remove')} tone="danger" onPress={() => setNoteFor({ kind: 'report', id: r.id, action: 'remove' })} />
          <Btn label={t('community_space.escalate')} tone="danger" onPress={() => Alert.alert(t('community_space.escalate'), t('community_space.escalate_confirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('community_space.escalate'), style: 'destructive', onPress: () => setNoteFor({ kind: 'report', id: r.id, action: 'escalate' }) }])} />
          {r.post_id ? <Btn label={t('community_space.open_post')} tone="plain" onPress={() => router.push(`/(teacher)/conversations/community/${r.post_id}` as Href)} /> : null}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        ListHeaderComponent={<PageHero onBack compact title={t('community_space.queue')} subtitle={t('community_space.queue_sub')} />}
        ListEmptyComponent={isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl4 }} /> : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl4, gap: spacing.sm }}>
            <Icon name="success" size={34} color={colors.success} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('community_space.queue_empty')}</Text>
          </View>
        )}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: nav.pageEnd + insets.bottom + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        windowSize={7}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
      />
      <TextSheet
        visible={noteFor !== null}
        title={t(`community_space.${noteFor?.action ?? 'hide'}`)}
        subtitle={t('community_space.note_sub')}
        placeholder={t('community_space.note_placeholder')}
        confirm={t(`community_space.${noteFor?.action ?? 'hide'}`)}
        pending={moderatePost.isPending || moderateComment.isPending || resolve.isPending}
        onClose={() => setNoteFor(null)}
        onSubmit={(note) => {
          if (!noteFor) return;
          const done = { onSuccess: () => setNoteFor(null), onError: (e: unknown) => Alert.alert('', getFriendlyErrorMessage(e)) };
          if (noteFor.kind === 'post') moderatePost.mutate({ postId: noteFor.id, action: noteFor.action as 'reject' | 'hide', note: note || undefined }, done);
          else if (noteFor.kind === 'comment') moderateComment.mutate({ commentId: noteFor.id, action: noteFor.action as 'reject' | 'hide', note: note || undefined }, done);
          else resolve.mutate({ reportId: noteFor.id, action: noteFor.action as ReportResolution, note: note || undefined }, done);
        }}
      />
    </View>
  );
}
