import { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme/index';
import { GeneratedAvatar } from '@/components/ui/GeneratedAvatar';
import type { CommunityAuthor } from '@/api/community';

/** A member's face: the teacher's logo when they have one, else the same generated character as the rest of the app. */
export const CommunityAvatar = memo(function CommunityAvatar({ author, size = 40, ring }: { author: Pick<CommunityAuthor, 'avatar_seed' | 'avatar_url' | 'name'>; size?: number; ring?: string | null }) {
  const inner = ring ? size - 6 : size;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring ?? 'transparent', backgroundColor: colors.surface }}>
      {author.avatar_url ? (
        <Image source={{ uri: author.avatar_url }} style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.surfaceSunken }} contentFit="cover" accessibilityLabel={author.name} />
      ) : (
        <GeneratedAvatar seed={author.avatar_seed || 'user-0'} size={inner} label={author.name} />
      )}
    </View>
  );
});
