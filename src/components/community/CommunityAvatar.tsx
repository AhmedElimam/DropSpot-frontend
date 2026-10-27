import { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme/index';
import { GeneratedAvatar } from '@/components/ui/GeneratedAvatar';
import { BrandMark } from '@/components/ui/BrandMark';
import type { CommunityAuthor } from '@/api/community';

/** A member's face: the same generated character as the rest of the app; the platform's own team wears the brand mark. */
export const CommunityAvatar = memo(function CommunityAvatar({ author, size = 40, ring }: { author: Pick<CommunityAuthor, 'avatar_seed' | 'avatar_url' | 'name' | 'role'>; size?: number; ring?: string | null }) {
  const inner = ring ? size - 6 : size;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring ?? 'transparent', backgroundColor: colors.surface }}>
      {author.role === 'staff' ? (
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={author.name}>
          <BrandMark size={Math.round(inner * 0.58)} tint="#FFFFFF" />
        </View>
      ) : author.avatar_url ? (
        <Image source={{ uri: author.avatar_url }} style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.surfaceSunken }} contentFit="cover" accessibilityLabel={author.name} />
      ) : (
        <GeneratedAvatar seed={author.avatar_seed || 'user-0'} size={inner} label={author.name} />
      )}
    </View>
  );
});
