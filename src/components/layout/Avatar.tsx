import { View, Text } from 'react-native';
import { memo } from 'react';
import { Image } from 'expo-image';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Sanad palette — ink indigo, muted green, apricot and siblings (no bright purple/cyan)
const avatarColors = [colors.brand, colors.success, colors.accentWarm, '#4A57B5', colors.danger, '#2A7DB0'];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// expo-image, not RN Image, and memoised: an avatar sits in EVERY roster row, so this is
// one of the most-mounted components in the app. RN's Image decodes the full-resolution
// remote file into memory and re-fetches it whenever a row is recycled; expo-image
// decodes to the displayed size and keeps a disk cache across scrolls and screens, which
// is exactly the pattern that showed up as memory growth (Play Console, 2026-09-22).
// `recyclingKey` tells it the view is being reused for a different person, so a stale
// face never flashes in a recycled row.
export const Avatar = memo(function Avatar({ name, size = 40, imageUrl }: AvatarProps) {
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

  const bgColor = getColorForName(name);
  const fontSize = size * 0.38;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize,
          color: colors.white,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
});
