import { View, Text } from 'react-native';
import { memo } from 'react';
import { Image } from 'expo-image';
import { GeneratedAvatar } from '@/components/ui/GeneratedAvatar';

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
  /** Something stable for the person (an id); the name is the fallback seed. */
  seed?: string | number | null;
}

// expo-image, not RN Image, and memoised: an avatar sits in EVERY roster row, so this is
// one of the most-mounted components in the app. RN's Image decodes the full-resolution
// remote file into memory and re-fetches it whenever a row is recycled; expo-image
// decodes to the displayed size and keeps a disk cache across scrolls and screens, which
// is exactly the pattern that showed up as memory growth (Play Console, 2026-09-22).
// `recyclingKey` tells it the view is being reused for a different person, so a stale
// face never flashes in a recycled row.
export const Avatar = memo(function Avatar({ name, size = 40, imageUrl, seed }: AvatarProps) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        recyclingKey={imageUrl}
        cachePolicy="memory-disk"
        transition={0}
        accessibilityRole="image"
        accessibilityLabel={name}
      />
    );
  }

  // No photo: a generated face, the same one for this person everywhere (no initials —
  // founder 2026-10-03: they «sometimes make a weird name»).
  return <GeneratedAvatar seed={String(seed ?? name)} size={size} label={name} />;
});
