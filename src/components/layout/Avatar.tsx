import { View, Text, Image } from 'react-native';
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

const avatarColors = [colors.primary, '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function Avatar({ name, size = 40, imageUrl }: AvatarProps) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
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
}
