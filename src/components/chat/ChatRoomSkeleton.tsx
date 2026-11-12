import { memo } from 'react';
import { View, Text, TouchableOpacity, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients } from '@/theme/index';
import { chat } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { RoomAvatar } from '@/components/chat/RoomAvatar';
import { ChatWallpaper } from '@/components/chat/ChatWallpaper';
import { bubbleSide } from '@/components/chat/ChatBubble';
import type { RoomId } from '@/chat/room';

/**
 * The room before its messages arrive (founder 2026-11-12: «it loads the whole page, not
 * opening the chat itself and skeleton-loading the messages»). The room is already the room —
 * its header with the name the inbox knows, its wallpaper, its composer bar — and only the
 * messages are placeholders: grey bubbles on the sides real ones take.
 *
 * Still on purpose: nothing here moves. A shimmer would be one more endless animation on a
 * screen that shows for well under a second (docs/PERFORMANCE.md §1).
 */

/** The placeholder bubbles, oldest first: whose side, how wide (share of the room), how many lines. */
export const SKELETON_BUBBLES: ReadonlyArray<{ mine: boolean; width: number; lines: 1 | 2 | 3 }> = [
  { mine: false, width: 0.62, lines: 2 },
  { mine: false, width: 0.38, lines: 1 },
  { mine: true, width: 0.52, lines: 1 },
  { mine: false, width: 0.7, lines: 3 },
  { mine: true, width: 0.64, lines: 2 },
  { mine: true, width: 0.34, lines: 1 },
  { mine: false, width: 0.48, lines: 1 },
  { mine: true, width: 0.58, lines: 2 },
];

/**
 * The placeholder messages alone — also what the room shows while it slides in with a saved
 * page: its header and composer are real at once, and the messages (the heavy part: a list
 * of bubbles, each with its gestures) mount when the page has landed.
 */
export const ChatSkeletonBubbles = memo(function ChatSkeletonBubbles() {
  const rtl = I18nManager.isRTL;
  return (
    // Anchored to the bottom, as the real (inverted) list is.
    <View pointerEvents="none" style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, overflow: 'hidden' }}>
      {SKELETON_BUBBLES.map((b, i) => {
        const line = b.mine ? 'rgba(255,255,255,0.45)' : colors.border;
        return (
          <View
            key={i}
            style={{
              alignSelf: bubbleSide(b.mine, rtl),
              width: `${Math.round(b.width * 100)}%`,
              marginTop: i > 0 && SKELETON_BUBBLES[i - 1].mine === b.mine ? 3 : spacing.md,
              backgroundColor: b.mine ? chat.bubbleMine : chat.bubbleTheirs,
              borderWidth: b.mine ? 0 : 1,
              borderColor: chat.bubbleTheirsBorder,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              gap: 8,
              opacity: b.mine ? 0.42 : 0.8,
            }}
          >
            {Array.from({ length: b.lines }, (_, l) => (
              <View key={l} style={{ height: 9, borderRadius: 5, backgroundColor: line, width: l === b.lines - 1 && b.lines > 1 ? '58%' : '100%' }} />
            ))}
          </View>
        );
      })}
    </View>
  );
});

export const ChatRoomSkeleton = memo(function ChatRoomSkeleton({ room, name, onBack }: {
  room: RoomId;
  /** The room's name when the inbox already has it; a grey bar stands in otherwise. */
  name?: string | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: chat.canvas }} accessibilityLabel={t('common.loading')}>
      {/* The same ink band, the same places, as the loaded room — nothing jumps when it lands. */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          paddingTop: insets.top + spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.sm,
        }}
      >
        <TouchableOpacity onPress={onBack} style={{ width: 40, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon name="forward" size={26} color={colors.onHero} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <RoomAvatar room={room} size={40} label={name ?? ''} />
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            {name ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.onHero }} numberOfLines={1}>{name}</Text>
            ) : (
              <View style={{ width: 150, height: 14, borderRadius: 7, marginVertical: 5, backgroundColor: colors.onHeroFaint, opacity: 0.5 }} />
            )}
            <View style={{ width: 96, height: 9, borderRadius: 5, marginTop: 5, marginBottom: 3, backgroundColor: colors.onHeroFaint, opacity: 0.35 }} />
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <ChatWallpaper />
        <ChatSkeletonBubbles />
      </View>

      {/* The composer's bar, not yet a field: its place is held so the messages do not shift. */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md + insets.bottom, backgroundColor: chat.bar, borderTopWidth: 1, borderTopColor: chat.barBorder }}>
        <View style={{ minHeight: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSunken, opacity: 0.6 }} />
      </View>
    </View>
  );
});
