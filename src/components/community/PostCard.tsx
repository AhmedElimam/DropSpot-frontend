import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BACKGROUNDS } from './backgrounds';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ago, arDigits } from '@/components/threads/format';
import type { CommunityMedia, CommunityPost, CommunityReaction, CommunityRole } from '@/api/community';
import { CommunityAvatar } from './CommunityAvatar';
import { ReactionGlyph, REACTION_TONE } from '@/components/reactions/ReactionGlyph';
import { ReactionPicker } from '@/components/reactions/ReactionPicker';

/** The community's four, drawn in the app's own reaction family (src/components/reactions). */
const REACTIONS: CommunityReaction[] = ['like', 'love', 'clap', 'idea'];
/** The card's side margin and inner padding — the pictures bleed to the card's edge. */
export const CARD_SIDE = 10;
const PAD = 14;

/** The role chip beside a name: the platform's own team stands out; a member is just a name. */
export function roleLabel(role: CommunityRole, t: (k: string) => string): string | null {
  return role === 'staff' ? t('community_space.role_staff') : null;
}

/**
 * One post, drawn the way a social feed draws one (founder 2026-10-28: «like Facebook»): the
 * face, the name and when; the words; the pictures bleeding to the card's edge; a quiet summary
 * line (who reacted how, how many comments); then two equal actions — a reaction and a comment —
 * with the long-press picker; and the newest comment as a preview under it all.
 *
 * The author's own held or rejected post carries a status strip saying why. memo + stable callbacks: a poll that returns the same rows
 * re-renders nothing. No entering animation (performance guardrails: list rows stay still).
 */
export const PostCard = memo(function PostCard({ post, headers, onOpen, onReact, onMore, onOpenImage, onComments, reactions, expanded = false }: {
  post: CommunityPost;
  /** Kept for the callers; nothing on a card depends on the reader now that nobody moderates from the app. */
  role?: CommunityRole;
  headers: Record<string, string> | null;
  onOpen?: (id: number) => void;
  onReact: (id: number, kind: CommunityReaction) => void;
  onMore: (post: CommunityPost) => void;
  onOpenImage?: (post: CommunityPost, index: number) => void;
  /** The reactions the server offers (limits.reactions); the app's four when absent. */
  reactions?: readonly CommunityReaction[];
  /** Open the comments sheet (the feed); without it the comment actions open the post. */
  onComments?: (post: CommunityPost) => void;
  /** The post screen: the whole body, no «more» clamp, no comment preview. */
  expanded?: boolean;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [showAll, setShowAll] = useState(expanded);
  const [picker, setPicker] = useState(false);
  const announcement = post.kind === 'announcement';
  const chip = roleLabel(post.author.role, t);
  const status = post.status !== 'published' ? post.status : null;
  const cardWidth = width - CARD_SIDE * 2;
  const total = post.reactions_count;
  const present = REACTIONS.filter((k) => (post.reaction_counts?.[k] ?? 0) > 0);
  const offered = reactions ? REACTIONS.filter((k) => reactions.includes(k)) : REACTIONS;
  const mine = post.my_reaction;
  const bg = post.background ? BACKGROUNDS[post.background] : null;
  const comments = () => (onComments ? onComments(post) : onOpen?.(post.id));

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: announcement ? colors.accentLight : colors.borderLight, overflow: 'hidden', ...shadows.sm }}>
      {announcement ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: PAD, paddingVertical: 6, backgroundColor: colors.accentWarmTint }}>
          <Icon name="pin" size={13} color={colors.accent} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.accent }}>{t(post.pinned ? 'community_space.pinned_announcement' : 'community_space.announcement')}</Text>
        </View>
      ) : post.pinned ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: PAD, paddingVertical: 6, backgroundColor: colors.brandTint }}>
          <Icon name="pin" size={13} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>{t('community_space.pinned')}</Text>
        </View>
      ) : null}

      {/* Who, when */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: PAD, paddingTop: PAD, paddingBottom: spacing.sm }}>
        <CommunityAvatar author={post.author} size={42} />
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{post.author.name}</Text>
            {chip ? <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.full, backgroundColor: colors.brandTint }}><Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.brand }}>{chip}</Text></View> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{ago(post.created_at)}</Text>
            {/* A thin bar, not «·»: a middle dot beside Arabic digits reads as a zero. */}
            <View style={{ width: 1, height: 11, backgroundColor: colors.border }} />
            <Icon name="people" size={12} color={colors.textTertiary} outline />
            {post.edited_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>({t('community_space.edited')})</Text> : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => onMore(post)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('community_space.more')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="more" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* The words — on a colour when the author chose one (a short text-only post) */}
      {post.body && bg ? (
        <Pressable onPress={onOpen ? () => onOpen(post.id) : undefined} disabled={!onOpen}>
          <LinearGradient colors={bg.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: Math.round(cardWidth * 0.62), alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, marginTop: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: post.body.length < 60 ? 24 : 20, lineHeight: post.body.length < 60 ? 38 : 32, color: bg.text, textAlign: 'center' }}>{post.body}</Text>
          </LinearGradient>
        </Pressable>
      ) : post.body ? (
        <Pressable onPress={() => (onOpen ? onOpen(post.id) : setShowAll(true))} disabled={!onOpen && showAll} style={{ paddingHorizontal: PAD, paddingBottom: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: post.body.length < 60 && !post.media.length ? 20 : 15.5, lineHeight: post.body.length < 60 && !post.media.length ? 32 : 24, color: colors.textPrimary }} numberOfLines={showAll ? undefined : 6}>{post.body}</Text>
          {!showAll && post.body.length > 240 ? <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textSecondary, marginTop: 2 }}>{t('community_space.see_more')}</Text> : null}
        </Pressable>
      ) : null}

      {/* The pictures bleed to the card's edge */}
      {post.media.length ? <Pictures media={post.media} width={cardWidth} headers={headers} onOpen={(i) => onOpenImage?.(post, i)} /> : null}

      {/* Words that read as someone hurting: held from the community and answered gently —
          the supportive line only, never «under review», never red (the spec §5.1). */}
      {status === 'held' && post.status_reason === 'support' ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginHorizontal: PAD, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
          <Icon name="chat" size={16} color={colors.brand} outline />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textPrimary }}>{post.status_note ?? ''}</Text>
        </View>
      ) : /* The author's own held / rejected post says why */ status ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginHorizontal: PAD, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: status === 'rejected' ? colors.dangerLight : colors.warningLight }}>
          <Icon name={status === 'rejected' ? 'warning' : 'hourglass'} size={16} color={status === 'rejected' ? colors.dangerText : colors.warningText} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: status === 'rejected' ? colors.dangerText : colors.warningText }}>
              {t(status === 'rejected' ? 'community_space.status_rejected' : post.status_reason === 'awaiting_review' ? 'community_space.status_awaiting' : 'community_space.status_held')}
            </Text>
            {post.status_note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 2 }}>{post.status_note}</Text> : null}
          </View>
        </View>
      ) : null}

      {post.status === 'published' ? (
        <View>
          {/* The summary line: who reacted how, how many comments */}
          {total > 0 || post.comments_count > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: spacing.sm, paddingBottom: 6 }}>
              {total > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {present.slice(0, 3).map((k, i) => (
                      <View key={k} style={{ marginStart: i ? -5 : 0, zIndex: 3 - i }}>
                        <ReactionGlyph kind={k} size={20} ring={colors.surface} />
                      </View>
                    ))}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{mine && total === 1 ? t('community_space.you') : arDigits(total)}</Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              {post.comments_count > 0 ? (
                <TouchableOpacity onPress={comments} disabled={!onOpen && !onComments}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{t('community_space.n_comments', { n: arDigits(post.comments_count) })}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* The actions */}
          <View style={{ marginHorizontal: PAD, borderTopWidth: 1, borderTopColor: colors.borderLight }} />
          {/* The actions sit on their own layer: the picker opens from here, above the comment
              preview drawn after it (it used to sit under that preview and swallow no taps). */}
          <View style={{ zIndex: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2 }}>
            <TouchableOpacity
              onPress={() => { if (picker) setPicker(false); else onReact(post.id, mine ?? 'like'); }}
              onLongPress={() => setPicker(true)}
              delayLongPress={220}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: !!mine }}
              accessibilityLabel={t('community_space.react_like')}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md }}
            >
              {mine ? <ReactionGlyph kind={mine} size={20} /> : <Icon name="like" size={19} color={colors.textSecondary} outline />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: mine ? REACTION_TONE[mine].ink : colors.textSecondary }}>{t(mine ? `community_space.react_${mine}` : 'community_space.like')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={comments} disabled={!onOpen && !onComments} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('community_space.comment')}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md }}>
              <Icon name="chat" size={19} color={colors.textSecondary} outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textSecondary }}>{t('community_space.comment')}</Text>
            </TouchableOpacity>
          </View>

          {/* The picker: our four, just above the actions, on a long press */}
          {picker ? (
            <ReactionPicker
              kinds={offered}
              mine={mine}
              label={(k) => t(`community_space.react_${k}`)}
              onPick={(k) => { setPicker(false); onReact(post.id, k as CommunityReaction); }}
              style={{ position: 'absolute', bottom: 44, start: PAD, zIndex: 20 }}
            />
          ) : null}
          </View>

          {/* The newest comment, as a preview */}
          {!expanded && post.last_comment ? (
            <TouchableOpacity onPress={comments} disabled={!onOpen && !onComments} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: PAD, paddingBottom: PAD, paddingTop: 4 }}>
              <CommunityAvatar author={post.last_comment.author} size={28} />
              <View style={{ flex: 1 }}>
                <View style={{ alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }} numberOfLines={1}>{post.last_comment.author.name}</Text>
                  {post.last_comment.body ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary }} numberOfLines={2}>{post.last_comment.body}</Text> : null}
                  {post.last_comment.attachment ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Icon name="image" size={13} color={colors.textSecondary} />
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('community_space.photo')}</Text>
                    </View>
                  ) : null}
                </View>
                {post.comments_count > 1 ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 4 }}>{t('community_space.view_all_comments', { n: arDigits(post.comments_count) })}</Text> : null}
              </View>
            </TouchableOpacity>
          ) : <View style={{ height: 6 }} />}
        </View>
      ) : <View style={{ height: PAD }} />}
    </View>
  );
});

/**
 * The pictures, stacked the way Facebook stacks them (founder 2026-10-28): one at its own shape;
 * two side by side; three as one tall beside two stacked; four as one wide over three; five or
 * more as two over three, «+N» on the last. Each opens the viewer at itself.
 */
function Pictures({ media, width, headers, onOpen }: { media: CommunityMedia[]; width: number; headers: Record<string, string> | null; onOpen: (index: number) => void }) {
  const gap = 2;
  const src = (m: CommunityMedia) => ({ uri: m.url, headers: headers ?? undefined });
  const img = (m: CommunityMedia, i: number, w: number, h: number, extra?: number) => (
    <Pressable key={m.id} onPress={() => onOpen(i)} style={{ width: w, height: h }} accessibilityRole="imagebutton">
      <Image source={src(m)} style={{ width: w, height: h, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={120} recyclingKey={String(m.id)} />
      {extra ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#FFFFFF' }}>+{arDigits(extra)}</Text></View> : null}
    </Pressable>
  );
  const n = media.length;
  if (n === 1) {
    const m = media[0];
    const h = Math.min(Math.round(width * 1.25), Math.max(180, Math.round(width * ((m.height ?? 3) / (m.width ?? 4)))));
    return <View style={{ marginTop: 4 }}>{img(m, 0, width, h)}</View>;
  }
  if (n === 2) {
    const w = (width - gap) / 2;
    return <View style={{ flexDirection: 'row', gap, marginTop: 4 }}>{media.map((m, i) => img(m, i, w, Math.round(w * 1.2)))}</View>;
  }
  if (n === 3) {
    const big = Math.round((width - gap) * 0.62);
    const side = width - gap - big;
    const h = Math.round(width * 0.8);
    return (
      <View style={{ flexDirection: 'row', gap, marginTop: 4 }}>
        {img(media[0], 0, big, h)}
        <View style={{ gap }}>{img(media[1], 1, side, (h - gap) / 2)}{img(media[2], 2, side, (h - gap) / 2)}</View>
      </View>
    );
  }
  if (n === 4) {
    const w = (width - gap * 2) / 3;
    return (
      <View style={{ gap, marginTop: 4 }}>
        {img(media[0], 0, width, Math.round(width * 0.62))}
        <View style={{ flexDirection: 'row', gap }}>{media.slice(1, 4).map((m, i) => img(m, i + 1, w, w))}</View>
      </View>
    );
  }
  const top = (width - gap) / 2;
  const bottom = (width - gap * 2) / 3;
  return (
    <View style={{ gap, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', gap }}>{media.slice(0, 2).map((m, i) => img(m, i, top, top))}</View>
      <View style={{ flexDirection: 'row', gap }}>{media.slice(2, 5).map((m, i) => img(m, i + 2, bottom, bottom, i === 2 && n > 5 ? n - 5 : 0))}</View>
    </View>
  );
}
