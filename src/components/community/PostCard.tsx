import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { ago, arDigits } from '@/components/threads/format';
import type { CommunityMedia, CommunityPost, CommunityReaction, CommunityRole } from '@/api/community';
import { CommunityAvatar } from './CommunityAvatar';

export const REACTION_GLYPH: Record<CommunityReaction, string> = { like: '👍', love: '❤️', clap: '👏', idea: '💡' };
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
export const PostCard = memo(function PostCard({ post, headers, onOpen, onReact, onMore, onOpenImage, expanded = false }: {
  post: CommunityPost;
  /** Kept for the callers; nothing on a card depends on the reader now that nobody moderates from the app. */
  role?: CommunityRole;
  headers: Record<string, string> | null;
  onOpen?: (id: number) => void;
  onReact: (id: number, kind: CommunityReaction) => void;
  onMore: (post: CommunityPost) => void;
  onOpenImage?: (post: CommunityPost, index: number) => void;
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
  const mine = post.my_reaction;

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

      {/* The words */}
      {post.body ? (
        <Pressable onPress={() => (onOpen ? onOpen(post.id) : setShowAll(true))} disabled={!onOpen && showAll} style={{ paddingHorizontal: PAD, paddingBottom: spacing.sm }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: post.body.length < 60 && !post.media.length ? 20 : 15.5, lineHeight: post.body.length < 60 && !post.media.length ? 32 : 24, color: colors.textPrimary }} numberOfLines={showAll ? undefined : 6}>{post.body}</Text>
          {!showAll && post.body.length > 240 ? <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textSecondary, marginTop: 2 }}>{t('community_space.see_more')}</Text> : null}
        </Pressable>
      ) : null}

      {/* The pictures bleed to the card's edge */}
      {post.media.length ? <Pictures media={post.media} width={cardWidth} headers={headers} onOpen={(i) => onOpenImage?.(post, i)} /> : null}

      {/* The author's own held / rejected post says why */}
      {status ? (
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
                      <View key={k} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginStart: i ? -6 : 0, borderWidth: 1, borderColor: colors.surface }}>
                        <Text style={{ fontSize: 12 }}>{REACTION_GLYPH[k]}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{mine && total === 1 ? t('community_space.you') : arDigits(total)}</Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              {post.comments_count > 0 ? (
                <TouchableOpacity onPress={() => onOpen?.(post.id)} disabled={!onOpen}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{t('community_space.n_comments', { n: arDigits(post.comments_count) })}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* The actions */}
          <View style={{ marginHorizontal: PAD, borderTopWidth: 1, borderTopColor: colors.borderLight }} />
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
              {mine ? <Text style={{ fontSize: 17 }}>{REACTION_GLYPH[mine]}</Text> : <Icon name="like" size={19} color={colors.textSecondary} outline />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: mine ? colors.brand : colors.textSecondary }}>{t(mine ? `community_space.react_${mine}` : 'community_space.like')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onOpen?.(post.id)} disabled={!onOpen} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('community_space.comment')}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md }}>
              <Icon name="chat" size={19} color={colors.textSecondary} outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textSecondary }}>{t('community_space.comment')}</Text>
            </TouchableOpacity>
          </View>

          {/* The picker: four faces above the actions, on a long press */}
          {picker ? (
            <View style={{ position: 'absolute', bottom: 46, start: PAD, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
              {REACTIONS.map((k) => (
                <TouchableOpacity key={k} onPress={() => { setPicker(false); onReact(post.id, k); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={t(`community_space.react_${k}`)}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: mine === k ? colors.brandTint : 'transparent' }}>
                  <Text style={{ fontSize: 26 }}>{REACTION_GLYPH[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* The newest comment, as a preview */}
          {!expanded && post.last_comment ? (
            <TouchableOpacity onPress={() => onOpen?.(post.id)} disabled={!onOpen} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: PAD, paddingBottom: PAD, paddingTop: 4 }}>
              <CommunityAvatar author={post.last_comment.author} size={28} />
              <View style={{ flex: 1 }}>
                <View style={{ alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary }} numberOfLines={1}>{post.last_comment.author.name}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary }} numberOfLines={2}>{post.last_comment.body}</Text>
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

/** One wide; two side by side; three or four as one wide over a row, «+N» on the last when more. */
function Pictures({ media, width, headers, onOpen }: { media: CommunityMedia[]; width: number; headers: Record<string, string> | null; onOpen: (index: number) => void }) {
  const gap = 2;
  const src = (m: CommunityMedia) => ({ uri: m.url, headers: headers ?? undefined });
  const img = (m: CommunityMedia, i: number, w: number, h: number, extra?: number) => (
    <Pressable key={m.id} onPress={() => onOpen(i)} style={{ width: w, height: h }}>
      <Image source={src(m)} style={{ width: w, height: h, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={120} />
      {extra ? <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#FFFFFF' }}>+{arDigits(extra)}</Text></View> : null}
    </Pressable>
  );
  if (media.length === 1) {
    const m = media[0];
    const h = Math.min(440, Math.max(180, Math.round(width * ((m.height ?? 3) / (m.width ?? 4)))));
    return <View style={{ marginTop: 4 }}>{img(m, 0, width, h)}</View>;
  }
  if (media.length === 2) {
    const w = (width - gap) / 2;
    return <View style={{ flexDirection: 'row', gap, marginTop: 4 }}>{media.map((m, i) => img(m, i, w, w))}</View>;
  }
  const rest = media.slice(1, 4);
  const w = (width - gap * (rest.length - 1)) / rest.length;
  return (
    <View style={{ gap, marginTop: 4 }}>
      {img(media[0], 0, width, Math.round(width * 0.6))}
      <View style={{ flexDirection: 'row', gap }}>{rest.map((m, i) => img(m, i + 1, w, w, i === rest.length - 1 && media.length > 4 ? media.length - 4 : 0))}</View>
    </View>
  );
}
