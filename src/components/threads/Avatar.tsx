import { memo } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/index';
import { senderColor } from '@/theme/chat';
import { initials } from './format';

/**
 * A person in حكاوي: a disc in their own colour (the chat's per-sender family, so a
 * classmate reads the same in both rooms) with their initials — or a logo when the payload
 * carries one. `ring` draws the accent ring an unread post or the reader's own answer wears.
 */
export const InitialsAvatar = memo(function InitialsAvatar({ id, name, size = 40, ring, logoUrl }: {
  id: number;
  name: string | null | undefined;
  size?: number;
  ring?: string | null;
  logoUrl?: string | null;
}) {
  const tone = senderColor(id);
  const inner = ring ? size - 6 : size;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring ?? 'transparent' }}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.surface }} contentFit="cover" />
      ) : (
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: Math.round(inner * 0.36), lineHeight: Math.round(inner * 0.5), color: '#FFFFFF', includeFontPadding: false }} numberOfLines={1}>
            {initials(name)}
          </Text>
        </View>
      )}
    </View>
  );
});
