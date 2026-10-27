import { memo, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { InitialsAvatar } from '@/components/threads/Avatar';
import { ago, arDigits } from '@/components/threads/format';
import type { CommunityPost, CommunityReaction, CommunityRole } from '@/api/community';

export const REACTION_GLYPH: Record<CommunityReaction, string> = { like: '👍', love: '❤️', clap: '👏', idea: '💡' };
const REACTIONS: CommunityReaction[] = ['like', 'love', 'clap', 'idea'];

/** The role chip beside a name: the teacher and their assistant stand out; a member is just a name. */
export function roleLabel(role: CommunityRole, t: (k: string) => string): string | null {
  return role === 'teacher' ? t('community_space.role_teacher') : role === 'assistant' ? t('community_space.role_assistant') : null;
}

/**
 * One post in the feed, drawn as a social card: who, when, the words, the pictures, then the
 * reactions and the comment count. The author's own held or rejected post carries a status
 * strip saying why; a moderator sees a gold «للمراجعة» on a flagged one.
 *
 * memo + stable callbacks: a poll that returns the same rows re-renders nothing.
 * No entering animation (performance guardrails: list rows stay still).
 */
export const PostCard = memo(function PostCard({ post, role, headers, onOpen, onReact, onMore, expanded = false }: {
  post: CommunityPost;
  role: CommunityRole;
  headers: Record<string, string> | null;
  onOpen?: (id: number) => void;
  onReact: (id: number, kind: CommunityReaction) => void;
  onMore: (post: CommunityPost) => void;
  /** The post screen: the whole body, no «more» clamp. */
  expanded?: boolean;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [showAll, setShowAll] = useState(expanded);
  const announcement = post.kind === 'announcement';
  const moderator = role === 'teacher' || role === 'assistant';
  const chip = roleLabel(post.author.role, t);
  const status = post.status !== 'published' ? post.status : null;
  const cardWidth = width - spacing.lg * 2 - spacing.lg * 2;
  const total = post.reactions_count;

  return (
    <View style={{ backgroundColor: announcement ? colors.accentWarmTint : colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: announcement ? colors.accentLight : colors.borderLight, padding: spacing.lg, gap: spacing.md, ...shadows.sm }}>
      {/* Who, when */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <InitialsAvatar id={post.author.id} name={post.author.name} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, flexShrink: 1 }} numberOfLines={1}>{post.author.name}</Text>
            {chip ? <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.full, backgroundColor: colors.brandTint }}><Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.brand }}>{chip}</Text></View> : null}
            {post.pinned ? <Icon name="pin" size={13} color={colors.accent} /> : null}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>
            {ago(post.created_at)}{post.edited_at ? ` · ${t('community_space.edited')}` : ''}{announcement ? ` · ${t('community_space.announcement')}` : ''}
          </Text>
        </View>
        {post.flagged && moderator ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.warningText }}>{t('community_space.flagged')}</Text>
          </View>
        ) : null}
        <TouchableOpacity onPress={() => onMore(post)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('community_space.more')}>
          <Icon name="more" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* The words */}
      {post.body ? (
        <TouchableOpacity activeOpacity={0.85} onPress={() => (onOpen ? onOpen(post.id) : setShowAll(true))} disabled={!onOpen && showAll}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textPrimary }} numberOfLines={showAll ? undefined : 7}>{post.body}</Text>
        </TouchableOpacity>
      ) : null}

      {/* The pictures: one wide, or squares two to a row */}
      {post.media.length === 1 ? (
        <Image
          source={{ uri: post.media[0].url, headers: headers ?? undefined }}
          style={{ width: cardWidth, height: Math.min(360, Math.round(cardWidth * ((post.media[0].height ?? 3) / (post.media[0].width ?? 4)))), borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}
          contentFit="cover"
          transition={120}
          accessibilityLabel={t('community_space.photo')}
        />
      ) : post.media.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {post.media.slice(0, 4).map((m) => (
            <Image key={m.id} source={{ uri: m.url, headers: headers ?? undefined }} style={{ width: (cardWidth - spacing.sm) / 2, height: (cardWidth - spacing.sm) / 2, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }} contentFit="cover" transition={120} accessibilityLabel={t('community_space.photo')} />
          ))}
        </View>
      ) : null}

      {/* The author's own held / rejected post says why */}
      {status ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: status === 'rejected' ? colors.dangerLight : colors.warningLight }}>
          <Icon name={status === 'rejected' ? 'warning' : 'hourglass'} size={16} color={status === 'rejected' ? colors.dangerText : colors.warningText} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: status === 'rejected' ? colors.dangerText : colors.warningText }}>
              {t(status === 'rejected' ? 'community_space.status_rejected' : post.status_reason === 'awaiting_review' ? 'community_space.status_awaiting' : 'community_space.status_held')}
            </Text>
            {post.status_note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 2 }}>{post.status_note}</Text> : null}
          </View>
        </View>
      ) : null}

      {/* Reactions and comments */}
      {post.status === 'published' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
          {REACTIONS.map((k) => {
            const n = post.reaction_counts?.[k] ?? 0;
            const on = post.my_reaction === k;
            return (
              <TouchableOpacity key={k} onPress={() => onReact(post.id, k)} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t(`community_space.react_${k}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 9, borderRadius: radius.full, backgroundColor: on ? colors.brandTint : colors.surfaceSunken, borderWidth: 1, borderColor: on ? colors.brand : 'transparent' }}>
                <Text style={{ fontSize: 14 }}>{REACTION_GLYPH[k]}</Text>
                {n > 0 ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: on ? colors.brand : colors.textSecondary }}>{arDigits(n)}</Text> : null}
              </TouchableOpacity>
            );
          })}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => onOpen?.(post.id)} disabled={!onOpen} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('community_space.comments')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.surfaceSunken }}>
            <Icon name="chat" size={15} color={colors.textSecondary} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary }}>{post.comments_count > 0 ? arDigits(post.comments_count) : t('community_space.comment')}</Text>
          </TouchableOpacity>
          {total > 0 ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginStart: spacing.xs }}>{arDigits(total)}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});
