import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ImageViewer } from '@/components/chat/ImageViewer';
import { InlineSheetHost } from '@/components/ui/SheetModal';
import { Alert } from '@/ui/dialog';
import { arDigits } from '@/components/threads/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useCommunitySpaces, useReactToCommunityMedia } from '@/hooks/useCommunity';
import { ReactionGlyph, REACTION_TONE } from '@/components/reactions/ReactionGlyph';
import { ReactionPicker } from '@/components/reactions/ReactionPicker';
import type { CommunityPost, CommunityReaction, CommunityRole } from '@/api/community';
import { CommentsSheet } from './CommentsSheet';
import { Surface } from '@/ui/surfaces';

const KNOWN: CommunityReaction[] = ['like', 'love', 'clap', 'idea'];

/**
 * A post's pictures inside the app (founder 2026-10-28: «in-app media like what we did with
 * chat, Facebook-style — react and comment on each picture»): chat's viewer (pinch, pan, swipe
 * between the post's pictures, pull down to close) with this picture's own reactions and comment
 * count under it. Its thread opens INSIDE the viewer's window — a second native modal over it
 * would be the very collision that froze the app.
 */
export function PostMediaViewer({ post, start, role, headers, onClose }: {
  post: CommunityPost;
  start: number;
  role: CommunityRole;
  headers: Record<string, string> | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(start);
  const [picker, setPicker] = useState(false);
  const [thread, setThread] = useState(false);
  const react = useReactToCommunityMedia();
  // The reactions the server offers (limits.reactions), in the app's own drawing.
  const offered = useCommunitySpaces().data?.limits?.reactions;
  const REACTIONS = offered ? KNOWN.filter((k) => offered.includes(k)) : KNOWN;
  useEffect(() => { setPicker(false); }, [index]);
  const m = post.media[Math.min(index, post.media.length - 1)];
  if (!m) return null;
  const mine = (m.my_reaction ?? null) as CommunityReaction | null;
  const total = m.reactions_count ?? 0;
  const present = REACTIONS.filter((k) => (m.reaction_counts?.[k] ?? 0) > 0);
  const many = post.media.length > 1;
  const reactWith = (kind: CommunityReaction) => { setPicker(false); react.mutate({ mediaId: m.id, kind }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }); };

  const footer = (
    <Surface id="community.picture.social">
    <View style={{ gap: spacing.sm }}>
      {picker ? <ReactionPicker kinds={REACTIONS} mine={mine} label={(k) => t(`community_space.react_${k}`)} onPick={(k) => reactWith(k as CommunityReaction)} style={{ alignSelf: 'center' }} /> : null}
      {/* This picture's summary: who reacted how, how many comments */}
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 22 }}>
        {total > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row' }}>
              {present.slice(0, 3).map((k, i) => <View key={k} style={{ marginStart: i ? -5 : 0, zIndex: 3 - i }}><ReactionGlyph kind={k} size={20} ring="#000000" /></View>)}
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>{arDigits(total)}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {(m.comments_count ?? 0) > 0 ? (
          <TouchableOpacity onPress={() => setThread(true)} hitSlop={6}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>{t('community_space.n_comments', { n: arDigits(m.comments_count ?? 0) })}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 4 }}>
        <TouchableOpacity onPress={() => (picker ? setPicker(false) : reactWith(mine ?? 'like'))} onLongPress={() => setPicker(true)} delayLongPress={220} activeOpacity={0.7}
          accessibilityRole="button" accessibilityState={{ selected: !!mine }} accessibilityLabel={t('community_space.react_like')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md }}>
          {mine ? <ReactionGlyph kind={mine} size={20} /> : <Icon name="like" size={19} color="#FFFFFF" outline />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: mine ? REACTION_TONE[mine].from : '#FFFFFF' }}>{t(mine ? `community_space.react_${mine}` : 'community_space.like')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setThread(true)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('community_space.comment')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md }}>
          <Icon name="chat" size={19} color="#FFFFFF" outline />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: '#FFFFFF' }}>{t('community_space.comment')}</Text>
        </TouchableOpacity>
      </View>
    </View>
    </Surface>
  );

  return (
    <ImageViewer
      visible
      url={m.url}
      headers={headers ?? {}}
      name={null}
      caption={post.author.name}
      onClose={onClose}
      onPrev={many && index > 0 ? () => setIndex(index - 1) : undefined}
      onNext={many && index < post.media.length - 1 ? () => setIndex(index + 1) : undefined}
      position={many ? { index, total: post.media.length } : undefined}
      footer={post.status === 'published' ? footer : null}
      overlay={thread ? (
        <InlineSheetHost>
          <CommentsSheet visible postId={post.id} audience={post.audience} mediaId={m.id} role={role} total={m.comments_count ?? 0} onClose={() => setThread(false)} />
        </InlineSheetHost>
      ) : null}
    />
  );
}
