import { memo } from 'react';
import { View } from 'react-native';
import { colors } from '@/theme/index';
import { GeneratedAvatar, avatarSeed } from '@/components/ui/GeneratedAvatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { RoomId } from '@/chat/room';

/**
 * A room's face (founder 2026-10-12: «generate random icons for each chat like the avatar
 * we've made»): the same generated character as people get, seeded by the room — so a course's
 * room keeps its character on every screen, and its parents' room has one of its own. An
 * optional badge says what kind of room it is (the class, the parents, a room you follow).
 */
export const RoomAvatar = memo(function RoomAvatar({ room, size = 44, badge, label, ring }: {
  room: RoomId;
  size?: number;
  badge?: 'students' | 'parents' | 'following' | null;
  label?: string;
  /** A ring around it, for a hero or the room you are in. */
  ring?: string;
}) {
  const icon: IconName | null = badge === 'parents' ? 'children' : badge === 'following' ? 'eye' : badge === 'students' ? 'people' : null;
  const dot = Math.max(16, Math.round(size * 0.42));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, ...(ring ? { borderWidth: 2, borderColor: ring } : null) }}>
      <GeneratedAvatar seed={avatarSeed.room(room)} size={ring ? size - 4 : size} label={label} />
      {icon ? (
        <View style={{ position: 'absolute', bottom: -2, end: -2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: badge === 'parents' ? colors.accent : colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
          <Icon name={icon} size={Math.round(dot * 0.5)} color={colors.onPrimary} />
        </View>
      ) : null}
    </View>
  );
});

/** What a room-list row's badge says. */
export function roomBadge(c: { audience?: string | null; read_only?: boolean }): 'students' | 'parents' | 'following' {
  if (c.audience === 'parents') return 'parents';
  return c.read_only ? 'following' : 'students';
}
